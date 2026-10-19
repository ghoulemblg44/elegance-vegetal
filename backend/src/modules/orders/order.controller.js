const mongoose = require('mongoose');

const { Order, ORDER_STATUSES } = require('./order.model');
const { PricingError, priceOrder } = require('../delivery/delivery.service');
const { roundMoney } = require('../delivery/delivery.calculator');

const ORDER_FLOW = {
  nouvelle: ['confirmee', 'annulee'],
  confirmee: ['preparation', 'annulee'],
  preparation: ['expediee', 'annulee'],
  expediee: ['livree'],
  livree: [],
  annulee: [],
};

const STATUS_ALIASES = {
  pending: 'nouvelle',
  new: 'nouvelle',
};

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;

const sendError = (res, status, message, errors) => {
  const payload = { status: 'error', message };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(status).json(payload);
};

const sendOk = (res, status, data, message) => {
  const payload = { status: 'ok' };
  if (message) {
    payload.message = message;
  }
  if (data !== undefined) {
    payload.data = data;
  }
  return res.status(status).json(payload);
};

const mongooseErrors = (error) =>
  Object.values(error.errors || {}).map((item) => ({
    field: item.path,
    message: item.message,
  }));

const handleError = (res, error) => {
  if (error.name === 'ValidationError') {
    return sendError(res, 400, 'Please correct the indicated fields.', mongooseErrors(error));
  }
  if (error.code === 11000) {
    return sendError(res, 409, 'An order with this reference already exists.');
  }
  if (error.name === 'CastError') {
    return sendError(res, 400, 'Invalid order id.');
  }
  console.error(error.message);
  return sendError(res, 500, 'An unexpected error occurred.');
};

const normalizeStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return 'nouvelle';
  }
  const mapped = STATUS_ALIASES[raw] || raw;
  return ORDER_STATUSES.includes(mapped) ? mapped : null;
};

const readSubmittedText = (value) => String(value == null ? '' : value).trim();

/**
 * Read what the browser is allowed to decide: who is ordering, where, how, and
 * which products/quantities. Money (subtotal, delivery fee, surcharge, total)
 * is NEVER read from here — the server computes it (see createOrder).
 */
const pickOrderFields = (body = {}) => {
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  return {
    orderReference: readSubmittedText(body.orderReference),
    customer: {
      fullName: readSubmittedText(customer.fullName),
      phone: readSubmittedText(customer.phone),
      wilaya: readSubmittedText(customer.wilaya),
      wilayaCode: readSubmittedText(customer.wilayaCode),
      address: readSubmittedText(customer.address),
    },
    items: Array.isArray(body.items) ? body.items : [],
    deliveryMethod: body.deliveryMethod,
    paymentMethod: body.paymentMethod || 'cash_on_delivery',
  };
};

const listOrders = async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return sendOk(res, 200, orders);
  } catch (error) {
    return handleError(res, error);
  }
};

const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return sendError(res, 400, 'Invalid order id.');
    }

    const order = await Order.findById(id);
    if (!order) {
      return sendError(res, 404, 'Order not found.');
    }

    return sendOk(res, 200, order);
  } catch (error) {
    return handleError(res, error);
  }
};

const createOrder = async (req, res) => {
  try {
    const payload = pickOrderFields(req.body);
    const errors = [];

    if (payload.customer.fullName.length < 3) {
      errors.push({ field: 'customer.fullName', message: 'Customer full name is required.' });
    }
    if (!payload.customer.phone) {
      errors.push({ field: 'customer.phone', message: 'Customer phone is required.' });
    }
    if (!payload.customer.wilayaCode && !payload.customer.wilaya) {
      errors.push({ field: 'customer.wilaya', message: 'Customer wilaya is required.' });
    }
    if (payload.customer.address.length > 300) {
      errors.push({ field: 'customer.address', message: 'Address is too long.' });
    }
    if (!payload.orderReference) {
      errors.push({ field: 'orderReference', message: 'Order reference is required.' });
    }
    if (!payload.items.length) {
      errors.push({ field: 'items', message: 'An order must contain at least one item.' });
    }

    if (errors.length) {
      return sendError(res, 400, 'Please correct the indicated fields.', errors);
    }

    // The server prices the order from database prices/weights and the tariff
    // table. Anything the browser sent for subtotal / deliveryFee / total is ignored...
    const quote = await priceOrder({
      items: payload.items,
      wilayaCode: payload.customer.wilayaCode,
      wilayaName: payload.customer.wilaya,
      deliveryMethod: payload.deliveryMethod,
    });

    if (!quote.available) {
      return res.status(422).json({
        status: 'error',
        code: 'DELIVERY_TARIFF_UNAVAILABLE',
        message: quote.message,
      });
    }

    // ...but if the browser says what total the customer was shown and it does
    // not match, refuse: the customer must see the new amount and confirm again,
    // instead of being charged something different from what was displayed.
    const body = req.body || {};
    if (body.total !== undefined && body.total !== null && body.total !== '') {
      const shown = Number(body.total);
      if (!Number.isFinite(shown) || Math.abs(roundMoney(shown) - quote.total) > 0.001) {
        return res.status(409).json({
          status: 'error',
          code: 'PRICE_MISMATCH',
          message: 'Le total a changé depuis votre dernière visite. Vérifiez le nouveau montant puis confirmez à nouveau.',
          data: quote,
        });
      }
    }

    const order = await Order.create({
      orderReference: payload.orderReference,
      customer: {
        fullName: payload.customer.fullName,
        phone: payload.customer.phone,
        wilaya: quote.wilaya.name,
        wilayaCode: quote.wilaya.code,
        ...(payload.customer.address ? { address: payload.customer.address } : {}),
      },
      items: quote.items.map((line) => ({
        productId: line.productId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
        image: line.image,
        weightKg: line.weightKg,
      })),
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      itemSurcharge: quote.itemSurcharge,
      weightSurcharge: quote.weightSurcharge,
      total: quote.total,
      paymentMethod: payload.paymentMethod,
      deliveryMethod: quote.deliveryMethod,
      delivery: {
        zone: quote.zone,
        weightKg: quote.weight.totalKg,
        weightComplete: quote.weight.complete,
        missingWeightProducts: quote.weight.missingProducts,
        weightBands: quote.weight.bands,
        weightRule: quote.weight.rule,
        itemCount: quote.itemCount,
        extraItems: Math.max(0, quote.itemCount - 1),
        feePerExtraItem: quote.itemsRule ? quote.itemsRule.feePerExtraItem : undefined,
      },
      // A public checkout can only ever create a new order; later states are
      // set by an authenticated admin through PUT /:id/status.
      status: 'nouvelle',
    });
    return sendOk(res, 201, order, 'Order created.');
  } catch (error) {
    if (error instanceof PricingError) {
      return res.status(error.status).json({
        status: 'error',
        code: error.code,
        message: error.message,
        ...(error.errors.length ? { errors: error.errors } : {}),
      });
    }
    return handleError(res, error);
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return sendError(res, 400, 'Invalid order id.');
    }

    const nextStatus = normalizeStatus(req.body?.status);
    if (!nextStatus) {
      return sendError(res, 400, 'Invalid order status.');
    }

    const order = await Order.findById(id);
    if (!order) {
      return sendError(res, 404, 'Order not found.');
    }

    if (!(ORDER_FLOW[order.status] || []).includes(nextStatus)) {
      return sendError(res, 400, 'This status change is not allowed.');
    }

    order.status = nextStatus;
    await order.save();
    return sendOk(res, 200, order, 'Order status updated.');
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
};
