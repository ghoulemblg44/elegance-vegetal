'use strict';

/**
 * Pure delivery calculations: no database, no HTTP, no side effects.
 * Everything that prices a delivery — the checkout quote and the stored order —
 * goes through the functions in this file.
 */

const { WILAYAS, findWilaya } = require('./delivery.wilayas');
const config = require('./delivery.config');

const { DELIVERY_METHODS } = config;

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

/** Weights are compared as integers of 1/1,000,000 kg to avoid float noise. */
const MICRO = 1e6;
const toMicro = (kg) => Math.round(Number(kg) * MICRO);

/** Money rounded to 2 decimals (DA amounts are normally whole numbers). */
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/* -------------------------------------------------------------------------- */
/* Tariffs                                                                    */
/* -------------------------------------------------------------------------- */

const isFee = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Build the tariff index (wilaya code -> { zone, home, stopDesk }) from the
 * supplied + additional tables. Fails loudly at start-up if the configuration
 * is inconsistent, rather than pricing orders from a broken table.
 */
const buildTariffIndex = (
  tables = [config.SUPPLIED_TARIFF_TABLE, config.ADDITIONAL_TARIFF_TABLE]
) => {
  const index = new Map();

  tables.flat().forEach((row) => {
    const wilaya = findWilaya({ name: row.destination });
    if (!wilaya) {
      throw new Error(`Delivery tariff "${row.destination}" does not match any wilaya.`);
    }
    if (index.has(wilaya.code)) {
      throw new Error(`Delivery tariff for "${row.destination}" is defined twice.`);
    }
    if (!isFee(row.home) || !isFee(row.stopDesk) || !Number.isInteger(row.zone)) {
      throw new Error(`Delivery tariff for "${row.destination}" is invalid.`);
    }
    index.set(
      wilaya.code,
      Object.freeze({ zone: row.zone, [DELIVERY_METHODS.HOME]: row.home, [DELIVERY_METHODS.STOP_DESK]: row.stopDesk })
    );
  });

  return index;
};

const TARIFF_INDEX = buildTariffIndex();

/** Tariff of one wilaya, or null when no tariff has been configured for it. */
const getTariff = (wilayaCode, index = TARIFF_INDEX) => index.get(String(wilayaCode)) || null;

/** Wilayas for which no tariff is configured (to be confirmed by the owner). */
const listUnconfiguredWilayas = (index = TARIFF_INDEX) => WILAYAS.filter((wilaya) => !index.has(wilaya.code));

/* -------------------------------------------------------------------------- */
/* Delivery method                                                            */
/* -------------------------------------------------------------------------- */

const METHOD_ALIASES = {
  home: DELIVERY_METHODS.HOME,
  domicile: DELIVERY_METHODS.HOME,
  stop_desk: DELIVERY_METHODS.STOP_DESK,
  stopdesk: DELIVERY_METHODS.STOP_DESK,
  'stop-desk': DELIVERY_METHODS.STOP_DESK,
  'stop desk': DELIVERY_METHODS.STOP_DESK,
};

/**
 * Normalise a delivery method. A missing value means "home" (what the
 * checkout used before Stop-Desk existed). An unknown value returns null.
 */
const normalizeDeliveryMethod = (value) => {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) {
    return DELIVERY_METHODS.HOME;
  }
  return METHOD_ALIASES[raw] || null;
};

/* -------------------------------------------------------------------------- */
/* Extra-item surcharge                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Delivery surcharge for extra units beyond the first.
 *
 *   itemCount <= 1  -> 0
 *   otherwise       -> (itemCount - 1) * feePerExtraItem
 *
 * @param {number} itemCount total quantity of units in the shipment
 * @param {number} [feePerExtraItem]
 * @returns {{itemCount:number, extraItems:number, surcharge:number, feePerExtraItem:number}}
 */
const calculateItemSurcharge = (itemCount, feePerExtraItem = config.EXTRA_ITEM_FEE) => {
  const count = Number(itemCount);
  const fee = Number(feePerExtraItem);
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Item count must be a whole number greater than or equal to 0.');
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new RangeError('Invalid extra-item fee.');
  }
  const extraItems = Math.max(0, count - 1);
  return {
    itemCount: count,
    extraItems,
    feePerExtraItem: fee,
    surcharge: roundMoney(extraItems * fee),
  };
};

/* -------------------------------------------------------------------------- */
/* Weight surcharge                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Weight surcharge for a shipment.
 *
 *   weight <= freeKg                      -> 0
 *   otherwise                             -> ceil((weight - freeKg) / stepKg) * feePerStep
 *
 * With the default rule (free 5 kg, 50 DA per started 5 kg):
 *   5 kg -> 0 · 5.001 kg -> 50 · 10 kg -> 50 · 10.001 kg -> 100 · 15 kg -> 100
 *
 * Weights are never rounded down: any weight above a band limit, however
 * small, starts the next band.
 *
 * @param {number} totalWeightKg total shipment weight in kg (>= 0)
 * @param {{freeKg:number, stepKg:number, feePerStep:number}} [rule]
 * @returns {{weightKg:number, bands:number, surcharge:number}}
 */
const calculateWeightSurcharge = (totalWeightKg, rule = config.WEIGHT_RULE) => {
  const kg = Number(totalWeightKg);
  if (!Number.isFinite(kg) || kg < 0) {
    throw new RangeError('Shipment weight must be a number greater than or equal to 0.');
  }
  if (!(rule.stepKg > 0) || !(rule.freeKg >= 0) || !(rule.feePerStep >= 0)) {
    throw new RangeError('Invalid weight surcharge rule.');
  }

  const weight = toMicro(kg);
  const free = toMicro(rule.freeKg);
  const step = toMicro(rule.stepKg);

  if (weight <= free) {
    return { weightKg: weight / MICRO, bands: 0, surcharge: 0 };
  }

  const bands = Math.ceil((weight - free) / step);
  return { weightKg: weight / MICRO, bands, surcharge: roundMoney(bands * rule.feePerStep) };
};

/**
 * Total weight of order lines. A line whose unit weight is unknown
 * (null/undefined/not a positive number) is reported in `missing` and is NOT
 * given an invented weight.
 *
 * @param {Array<{productId:string, name:string, quantity:number, weightKg:?number}>} lines
 */
const sumWeight = (lines) => {
  let micro = 0;
  const missing = [];

  lines.forEach((line) => {
    const unit = line.weightKg;
    if (typeof unit !== 'number' || !Number.isFinite(unit) || unit <= 0) {
      missing.push({ productId: line.productId, name: line.name });
      return;
    }
    micro += toMicro(unit) * line.quantity;
  });

  return { totalKg: micro / MICRO, complete: missing.length === 0, missing };
};

/* -------------------------------------------------------------------------- */
/* Delivery price                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Price the delivery of one shipment.
 *
 * @param {{wilayaCode:string, deliveryMethod:string, totalWeightKg:number, itemCount?:number}} input
 * @returns {{available:true, zone:number, baseFee:number, weight:object, weightSurcharge:number, itemSurcharge:number, items:object, deliveryTotal:number}
 *         | {available:false, reason:string, message:string}}
 */
const calculateDelivery = (
  { wilayaCode, deliveryMethod, totalWeightKg, itemCount = 1 },
  { index = TARIFF_INDEX, rule = config.WEIGHT_RULE, extraItemFee = config.EXTRA_ITEM_FEE } = {}
) => {
  const wilaya = findWilaya({ code: wilayaCode });
  if (!wilaya) {
    return { available: false, reason: 'WILAYA_REQUIRED', message: 'Choisissez votre wilaya pour calculer la livraison.' };
  }

  const method = normalizeDeliveryMethod(deliveryMethod);
  if (!method) {
    return { available: false, reason: 'INVALID_METHOD', message: 'Mode de livraison invalide.' };
  }

  const tariff = getTariff(wilaya.code, index);
  if (!tariff) {
    return {
      available: false,
      reason: 'TARIFF_UNAVAILABLE',
      message: `Le tarif de livraison pour ${wilaya.name} n'est pas encore disponible. Contactez-nous pour passer commande.`,
    };
  }

  const baseFee = tariff[method];
  const weight = calculateWeightSurcharge(totalWeightKg, rule);
  const items = calculateItemSurcharge(itemCount, extraItemFee);

  return {
    available: true,
    zone: tariff.zone,
    baseFee,
    weight: { totalKg: weight.weightKg, bands: weight.bands, rule },
    weightSurcharge: weight.surcharge,
    items,
    itemSurcharge: items.surcharge,
    deliveryTotal: roundMoney(baseFee + weight.surcharge + items.surcharge),
  };
};

/** Base fee of every method for a wilaya (to show next to each choice). */
const listMethodFees = (wilayaCode, index = TARIFF_INDEX) => {
  const tariff = getTariff(wilayaCode, index);
  return {
    [DELIVERY_METHODS.HOME]: tariff ? tariff[DELIVERY_METHODS.HOME] : null,
    [DELIVERY_METHODS.STOP_DESK]: tariff ? tariff[DELIVERY_METHODS.STOP_DESK] : null,
  };
};

module.exports = {
  DELIVERY_METHODS,
  roundMoney,
  buildTariffIndex,
  getTariff,
  listUnconfiguredWilayas,
  normalizeDeliveryMethod,
  calculateItemSurcharge,
  calculateWeightSurcharge,
  sumWeight,
  calculateDelivery,
  listMethodFees,
  TARIFF_INDEX,
};
