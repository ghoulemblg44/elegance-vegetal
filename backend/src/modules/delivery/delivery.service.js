'use strict';

/**
 * Authoritative order pricing.
 *
 * `priceOrder` is the ONLY place where an order's subtotal, delivery fee,
 * weight surcharge and total are computed. It reads prices and weights from
 * MongoDB and ignores anything the browser says about money.
 *
 * It is used by:
 *   - POST /api/delivery/quote  (what the checkout page displays)
 *   - POST /api/orders          (what is stored on the order)
 * so the total shown to the customer and the total saved can never diverge.
 */

const mongoose = require('mongoose');

const Product = require('../products/product.model');
const config = require('./delivery.config');
const { findWilaya } = require('./delivery.wilayas');
const {
  roundMoney,
  normalizeDeliveryMethod,
  sumWeight,
  calculateDelivery,
  listMethodFees,
} = require('./delivery.calculator');
const tariffStore = require('./delivery.tariff-store');

const MAX_LINES = 50;
const MAX_QUANTITY = 99;

/** A request problem that the API reports as a 4xx with field-level errors. */
class PricingError extends Error {
  constructor(message, { status = 400, code = 'INVALID_REQUEST', errors = [] } = {}) {
    super(message);
    this.name = 'PricingError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(value) && mongoose.Types.ObjectId.isValid(value);

/**
 * Validate the cart lines sent by the browser. Only the product reference and
 * the quantity are read — any price/name/weight in the payload is ignored.
 */
const parseRequestedLines = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PricingError('An order must contain at least one item.', {
      errors: [{ field: 'items', message: 'An order must contain at least one item.' }],
    });
  }
  if (items.length > MAX_LINES) {
    throw new PricingError(`An order cannot contain more than ${MAX_LINES} different products.`, {
      errors: [{ field: 'items', message: `Too many different products (max ${MAX_LINES}).` }],
    });
  }

  const errors = [];
  const lines = items.map((item, index) => {
    const ref = String(item && item.productId != null ? item.productId : '').trim();
    const quantity = Number(item && item.quantity);

    if (!ref) {
      errors.push({ field: `items[${index}].productId`, message: 'Product id is required.' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      errors.push({
        field: `items[${index}].quantity`,
        message: `Quantity must be a whole number between 1 and ${MAX_QUANTITY}.`,
      });
    }
    return { ref, quantity, index };
  });

  if (errors.length) {
    throw new PricingError('Please correct the indicated fields.', { errors });
  }
  return lines;
};

/** Load the products referenced by the cart (by Mongo _id or by slug). */
const loadProducts = async (lines) => {
  const ids = [];
  const slugs = [];
  lines.forEach(({ ref }) => (isObjectId(ref) ? ids : slugs).push(ref));

  const clauses = [];
  if (ids.length) {
    clauses.push({ _id: { $in: ids } });
  }
  if (slugs.length) {
    clauses.push({ slug: { $in: slugs.map((slug) => slug.toLowerCase()) } });
  }

  const products = await Product.find({ $or: clauses });
  const byId = new Map();
  const bySlug = new Map();
  products.forEach((product) => {
    byId.set(String(product._id), product);
    if (product.slug) {
      bySlug.set(String(product.slug).toLowerCase(), product);
    }
  });

  return (ref) => (isObjectId(ref) ? byId.get(ref.toLowerCase()) : bySlug.get(ref.toLowerCase())) || null;
};

/**
 * Price an order.
 *
 * @param {object} input
 * @param {Array<{productId:string, quantity:number}>} input.items
 * @param {string} [input.wilayaCode]  preferred wilaya identifier
 * @param {string} [input.wilayaName]  fallback for older clients
 * @param {string} [input.deliveryMethod]  'home' | 'stop_desk' (default 'home')
 * @returns {Promise<object>} the quote — see `available` / `reason` for tariff problems
 * @throws {PricingError} unknown/inactive products, bad quantities, unknown wilaya, bad method
 */
const priceOrder = async ({ items, wilayaCode, wilayaName, deliveryMethod } = {}) => {
  const requested = parseRequestedLines(items);

  const method = normalizeDeliveryMethod(deliveryMethod);
  if (!method) {
    throw new PricingError('Invalid delivery method.', {
      errors: [{ field: 'deliveryMethod', message: 'Delivery method must be "home" or "stop_desk".' }],
    });
  }

  const hasWilayaInput = String(wilayaCode || '').trim() || String(wilayaName || '').trim();
  const wilaya = hasWilayaInput ? findWilaya({ code: wilayaCode, name: wilayaName }) : null;
  if (hasWilayaInput && !wilaya) {
    throw new PricingError('Unknown wilaya.', {
      errors: [{ field: 'customer.wilaya', message: 'Choose a wilaya from the list of 58 wilayas.' }],
    });
  }

  // --- products: real prices and weights come from the database --------------
  const resolve = await loadProducts(requested);
  const productErrors = [];
  const merged = new Map(); // product _id -> line (same product sent twice is merged)

  requested.forEach(({ ref, quantity, index }) => {
    const product = resolve(ref);
    if (!product) {
      productErrors.push({ field: `items[${index}].productId`, message: 'Unknown product.' });
      return;
    }
    if (product.isActive === false) {
      productErrors.push({
        field: `items[${index}].productId`,
        message: `"${product.name}" is no longer available.`,
      });
      return;
    }

    const key = String(product._id);
    const existing = merged.get(key);
    const nextQuantity = (existing ? existing.quantity : 0) + quantity;
    if (nextQuantity > MAX_QUANTITY) {
      productErrors.push({
        field: `items[${index}].quantity`,
        message: `Quantity cannot exceed ${MAX_QUANTITY} for "${product.name}".`,
      });
      return;
    }
    merged.set(key, {
      productId: key,
      name: product.name,
      image: product.image || '',
      unitPrice: Number(product.price),
      quantity: nextQuantity,
      weightKg: typeof product.weightKg === 'number' ? product.weightKg : null,
    });
  });

  if (productErrors.length) {
    throw new PricingError('Some products in your cart are not available.', {
      code: 'INVALID_PRODUCTS',
      errors: productErrors,
    });
  }

  const lines = [...merged.values()].map((line) => ({
    ...line,
    subtotal: roundMoney(line.unitPrice * line.quantity),
  }));
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  // --- weight -----------------------------------------------------------------
  const weight = sumWeight(lines);
  if (!weight.complete && config.REQUIRE_PRODUCT_WEIGHTS) {
    throw new PricingError('Delivery cannot be priced: some products have no recorded weight.', {
      status: 422,
      code: 'PRODUCT_WEIGHT_MISSING',
      errors: weight.missing.map((entry) => ({
        field: 'items',
        message: `Weight missing for "${entry.name}".`,
      })),
    });
  }

  // --- delivery (wilaya tariffs + extra-item fee from admin store) ------------
  const [tariffIndex, extraItemFee] = await Promise.all([
    tariffStore.getTariffIndex(),
    tariffStore.getExtraItemFee(),
  ]);

  const delivery = calculateDelivery(
    {
      wilayaCode: wilaya ? wilaya.code : '',
      deliveryMethod: method,
      totalWeightKg: weight.totalKg,
      itemCount,
    },
    { index: tariffIndex, extraItemFee }
  );

  const quote = {
    items: lines,
    subtotal,
    itemCount,
    wilaya: wilaya ? { code: wilaya.code, name: wilaya.name } : null,
    deliveryMethod: method,
    available: delivery.available,
    reason: delivery.available ? null : delivery.reason,
    message: delivery.available ? null : delivery.message,
    deliveryFee: null,
    itemSurcharge: null,
    weightSurcharge: null,
    total: null,
    zone: null,
    weight: {
      totalKg: weight.totalKg,
      complete: weight.complete,
      missingProducts: weight.missing,
      bands: 0,
      rule: config.WEIGHT_RULE,
    },
    itemsRule: { feePerExtraItem: extraItemFee },
    options: wilaya ? listMethodFees(wilaya.code, tariffIndex) : { home: null, stop_desk: null },
  };

  if (delivery.available) {
    quote.zone = delivery.zone;
    quote.deliveryFee = delivery.baseFee;
    quote.itemSurcharge = delivery.itemSurcharge;
    quote.weightSurcharge = delivery.weightSurcharge;
    quote.weight.bands = delivery.weight.bands;
    quote.total = roundMoney(subtotal + delivery.baseFee + delivery.itemSurcharge + delivery.weightSurcharge);
  }

  return quote;
};

module.exports = {
  PricingError,
  priceOrder,
  MAX_LINES,
  MAX_QUANTITY,
};
