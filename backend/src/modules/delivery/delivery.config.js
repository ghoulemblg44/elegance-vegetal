'use strict';

/**
 * Delivery configuration — the single source of truth for tariffs and the
 * weight surcharge rule. Nothing else in the project hardcodes a delivery price.
 *
 * All amounts are in Algerian dinars (DA).
 */

const DELIVERY_METHODS = Object.freeze({
  HOME: 'home',
  STOP_DESK: 'stop_desk',
});

/**
 * TARIFF TABLE SUPPLIED BY THE BUSINESS OWNER — transcribed row for row.
 * Do not edit these values; they are the owner's data.
 *
 *   destination : wilaya name (must match the wilaya list exactly)
 *   zone        : carrier zone (informational, stored on the order)
 *   home        : home delivery fee
 *   stopDesk    : Stop-Desk (office pick-up) fee
 */
const SUPPLIED_TARIFF_TABLE = Object.freeze([
  { destination: 'Alger', zone: 0, home: 500, stopDesk: 450 },

  { destination: 'Blida', zone: 1, home: 650, stopDesk: 600 },
  { destination: 'Boumerdès', zone: 1, home: 650, stopDesk: 600 },
  { destination: 'Tipaza', zone: 1, home: 650, stopDesk: 600 },

  { destination: 'Chlef', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Oum El Bouaghi', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Batna', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Béjaïa', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Bouira', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Tlemcen', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Tiaret', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Tizi Ouzou', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Jijel', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Sétif', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Saïda', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Skikda', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Sidi Bel Abbès', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Annaba', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Guelma', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Constantine', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Médéa', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Mostaganem', zone: 2, home: 850, stopDesk: 700 },
  { destination: "M'Sila", zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Mascara', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Oran', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Bordj Bou Arréridj', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'El Tarf', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Tissemsilt', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Khenchela', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Souk Ahras', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Mila', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Aïn Defla', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Aïn Témouchent', zone: 2, home: 850, stopDesk: 700 },
  { destination: 'Relizane', zone: 2, home: 850, stopDesk: 700 },

  { destination: 'Laghouat', zone: 3, home: 1000, stopDesk: 850 },
  { destination: 'Biskra', zone: 3, home: 1000, stopDesk: 850 },
  { destination: 'Tébessa', zone: 3, home: 1000, stopDesk: 850 },
  { destination: 'Djelfa', zone: 3, home: 1000, stopDesk: 850 },
  { destination: 'Ouargla', zone: 3, home: 1000, stopDesk: 850 },
  { destination: 'El Oued', zone: 3, home: 1000, stopDesk: 850 },
  { destination: 'Ghardaïa', zone: 3, home: 1000, stopDesk: 850 },

  { destination: 'Adrar', zone: 4, home: 1450, stopDesk: 1150 },
  { destination: 'Béchar', zone: 4, home: 1450, stopDesk: 1150 },
  { destination: 'El Bayadh', zone: 4, home: 1450, stopDesk: 1150 },
  { destination: 'Naâma', zone: 4, home: 1450, stopDesk: 1150 },
  { destination: 'Tamanrasset', zone: 4, home: 1450, stopDesk: 1150 },

  { destination: 'Illizi', zone: 5, home: 1650, stopDesk: 1550 },
  { destination: 'Tindouf', zone: 5, home: 1650, stopDesk: 1550 },
]);

/**
 * TARIFFS STILL TO BE CONFIRMED.
 *
 * The supplied table covers 48 of the 58 wilayas. These 10 are absent:
 *   49 Timimoun · 50 Bordj Badji Mokhtar · 51 Ouled Djellal · 52 Béni Abbès ·
 *   53 In Salah · 54 In Guezzam · 55 Touggourt · 56 Djanet · 57 El M'Ghair ·
 *   58 El Meniaa
 *
 * No price has been invented for them: until a row is added here, checkout
 * shows a clear "tariff unavailable" message and refuses to create the order.
 * Once the carrier confirms the prices, add rows in the same shape as above:
 *
 *   { destination: 'Touggourt', zone: 3, home: 0000, stopDesk: 0000 },
 */
const ADDITIONAL_TARIFF_TABLE = Object.freeze([]);

/**
 * Weight surcharge rule: `feePerStep` DA for every started `stepKg` kilograms
 * above `freeKg`.
 *
 *   weight <= freeKg                   -> no surcharge
 *   freeKg  < weight <= freeKg + 1 step  -> 1 x feePerStep
 *   ... and so on, one more step each time a further `stepKg` is started.
 *
 * ASSUMPTION (not yet confirmed with the carrier): the first 5 kg are free
 * and the +50 DA band applies to every *started* 5 kg above that. Adjust here
 * or through the environment variables below — no code change needed.
 */
const WEIGHT_RULE_DEFAULTS = Object.freeze({
  freeKg: 5,
  stepKg: 5,
  feePerStep: 50,
});

/**
 * Extra-item delivery rule: the first unit is included in the wilaya base fee;
 * each additional unit adds `feePerExtraItem` DA (default 250).
 *
 *   1 item  -> 0
 *   2 items -> 250 DA
 *   3 items -> 500 DA
 *
 * Override with DELIVERY_EXTRA_ITEM_FEE, or change it in the admin panel
 * (stored in MongoDB and preferred over this default).
 */
const EXTRA_ITEM_FEE_DEFAULT = 250;

const positiveNumber = (raw, fallback, { allowZero = false } = {}) => {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
  if (!ok) {
    throw new Error(`Invalid delivery configuration value: "${raw}".`);
  }
  return value;
};

/**
 * Build the weight rule from environment variables (all optional):
 *   DELIVERY_WEIGHT_FREE_KG, DELIVERY_WEIGHT_STEP_KG, DELIVERY_WEIGHT_STEP_FEE
 */
const loadWeightRule = (env = process.env) =>
  Object.freeze({
    freeKg: positiveNumber(env.DELIVERY_WEIGHT_FREE_KG, WEIGHT_RULE_DEFAULTS.freeKg, { allowZero: true }),
    stepKg: positiveNumber(env.DELIVERY_WEIGHT_STEP_KG, WEIGHT_RULE_DEFAULTS.stepKg),
    feePerStep: positiveNumber(env.DELIVERY_WEIGHT_STEP_FEE, WEIGHT_RULE_DEFAULTS.feePerStep, { allowZero: true }),
  });

/**
 * Extra-item fee from env (optional). Admin-stored value overrides this at runtime.
 *   DELIVERY_EXTRA_ITEM_FEE
 */
const loadExtraItemFee = (env = process.env) =>
  positiveNumber(env.DELIVERY_EXTRA_ITEM_FEE, EXTRA_ITEM_FEE_DEFAULT, { allowZero: true });

/**
 * When true, an order is refused if any product has no weight recorded.
 * Default false: orders are accepted, the missing weights are stored on the
 * order and flagged in Admin so the surcharge can be checked by hand.
 */
const loadRequireProductWeights = (env = process.env) =>
  String(env.DELIVERY_REQUIRE_PRODUCT_WEIGHTS || '').trim().toLowerCase() === 'true';

module.exports = {
  DELIVERY_METHODS,
  SUPPLIED_TARIFF_TABLE,
  ADDITIONAL_TARIFF_TABLE,
  WEIGHT_RULE_DEFAULTS,
  EXTRA_ITEM_FEE_DEFAULT,
  WEIGHT_RULE: loadWeightRule(),
  EXTRA_ITEM_FEE: loadExtraItemFee(),
  REQUIRE_PRODUCT_WEIGHTS: loadRequireProductWeights(),
  loadWeightRule,
  loadExtraItemFee,
  loadRequireProductWeights,
};
