'use strict';

/**
 * Editable delivery tariffs backed by MongoDB, with the hardcoded config table
 * as the seed / offline fallback (so tests and first boot keep working).
 */

const mongoose = require('mongoose');

const config = require('./delivery.config');
const { WILAYAS, findWilaya } = require('./delivery.wilayas');
const { buildTariffIndex, DELIVERY_METHODS } = require('./delivery.calculator');
const DeliverySettings = require('./delivery.settings.model');

const SETTINGS_KEY = 'delivery';

let cache = null;

const isDbReady = () => mongoose.connection.readyState === 1;

/** Build the default settings document from the supplied config tables. */
const buildDefaultSettings = () => {
  const index = buildTariffIndex();
  const tariffs = WILAYAS.map((wilaya) => {
    const tariff = index.get(wilaya.code);
    return {
      code: wilaya.code,
      zone: tariff ? tariff.zone : 0,
      home: tariff ? tariff[DELIVERY_METHODS.HOME] : null,
      stopDesk: tariff ? tariff[DELIVERY_METHODS.STOP_DESK] : null,
    };
  });
  return {
    key: SETTINGS_KEY,
    extraItemFee: config.EXTRA_ITEM_FEE,
    tariffs,
  };
};

/** Turn stored tariff rows into the Map used by the calculator. */
const indexFromTariffs = (tariffs) => {
  const index = new Map();
  (tariffs || []).forEach((row) => {
    const wilaya = findWilaya({ code: row.code });
    if (!wilaya) {
      return;
    }
    const home = row.home;
    const stopDesk = row.stopDesk;
    if (
      typeof home !== 'number' ||
      !Number.isFinite(home) ||
      home < 0 ||
      typeof stopDesk !== 'number' ||
      !Number.isFinite(stopDesk) ||
      stopDesk < 0
    ) {
      return; // unavailable wilaya
    }
    index.set(
      wilaya.code,
      Object.freeze({
        zone: Number.isInteger(row.zone) ? row.zone : 0,
        [DELIVERY_METHODS.HOME]: home,
        [DELIVERY_METHODS.STOP_DESK]: stopDesk,
      })
    );
  });
  return index;
};

const toPublicSettings = (doc) => {
  const byCode = new Map((doc.tariffs || []).map((row) => [row.code, row]));
  const wilayas = WILAYAS.map((wilaya) => {
    const row = byCode.get(wilaya.code);
    const home = row && typeof row.home === 'number' ? row.home : null;
    const stopDesk = row && typeof row.stopDesk === 'number' ? row.stopDesk : null;
    const available = home != null && stopDesk != null;
    return {
      code: wilaya.code,
      name: wilaya.name,
      available,
      zone: row && Number.isInteger(row.zone) ? row.zone : null,
      home,
      stopDesk,
    };
  });

  return {
    extraItemFee: typeof doc.extraItemFee === 'number' ? doc.extraItemFee : config.EXTRA_ITEM_FEE,
    weightRule: config.WEIGHT_RULE,
    methods: Object.values(DELIVERY_METHODS),
    wilayas,
    unconfiguredWilayas: wilayas.filter((wilaya) => !wilaya.available).map((wilaya) => wilaya.code),
  };
};

const setCache = (doc) => {
  cache = {
    index: indexFromTariffs(doc.tariffs),
    extraItemFee: typeof doc.extraItemFee === 'number' ? doc.extraItemFee : config.EXTRA_ITEM_FEE,
    settings: toPublicSettings(doc),
  };
  return cache;
};

const ensureSeeded = async () => {
  if (!isDbReady()) {
    return setCache(buildDefaultSettings());
  }

  let doc = await DeliverySettings.findOne({ key: SETTINGS_KEY }).lean();
  if (!doc) {
    const defaults = buildDefaultSettings();
    doc = (await DeliverySettings.create(defaults)).toObject();
  }
  return setCache(doc);
};

const getRuntime = async () => {
  if (cache) {
    return cache;
  }
  return ensureSeeded();
};

const getTariffIndex = async () => (await getRuntime()).index;

const getExtraItemFee = async () => (await getRuntime()).extraItemFee;

const getPublicSettings = async () => (await getRuntime()).settings;

/**
 * Replace tariffs / extra-item fee from the admin panel.
 * @param {{extraItemFee?:number, wilayas:Array<{code:string, zone?:number, home:number|null, stopDesk:number|null}>}} payload
 */
const updateSettings = async ({ extraItemFee, wilayas } = {}) => {
  if (!isDbReady()) {
    const error = new Error('Database is not connected.');
    error.status = 503;
    error.code = 'DB_UNAVAILABLE';
    throw error;
  }

  if (!Array.isArray(wilayas) || wilayas.length === 0) {
    const error = new Error('Wilaya tariffs are required.');
    error.status = 400;
    error.code = 'INVALID_TARIFFS';
    throw error;
  }

  const fee =
    extraItemFee === undefined || extraItemFee === null || extraItemFee === ''
      ? config.EXTRA_ITEM_FEE
      : Number(extraItemFee);
  if (!Number.isFinite(fee) || fee < 0) {
    const error = new Error('Extra-item fee must be a number greater than or equal to 0.');
    error.status = 400;
    error.code = 'INVALID_EXTRA_ITEM_FEE';
    throw error;
  }

  const byCode = new Map();
  const errors = [];
  wilayas.forEach((row, index) => {
    const code = String(row && row.code != null ? row.code : '').trim().padStart(2, '0');
    const wilaya = findWilaya({ code });
    if (!wilaya) {
      errors.push({ field: `wilayas[${index}].code`, message: 'Unknown wilaya code.' });
      return;
    }
    if (byCode.has(wilaya.code)) {
      errors.push({ field: `wilayas[${index}].code`, message: 'Wilaya listed twice.' });
      return;
    }

    const homeRaw = row.home;
    const deskRaw = row.stopDesk;
    const homeEmpty = homeRaw === null || homeRaw === undefined || homeRaw === '';
    const deskEmpty = deskRaw === null || deskRaw === undefined || deskRaw === '';

    if (homeEmpty !== deskEmpty) {
      errors.push({
        field: `wilayas[${index}]`,
        message: `Set both home and stop-desk fees for ${wilaya.name}, or leave both empty.`,
      });
      return;
    }

    let home = null;
    let stopDesk = null;
    if (!homeEmpty) {
      home = Number(homeRaw);
      stopDesk = Number(deskRaw);
      if (!Number.isFinite(home) || home < 0 || !Number.isFinite(stopDesk) || stopDesk < 0) {
        errors.push({
          field: `wilayas[${index}]`,
          message: `Fees for ${wilaya.name} must be numbers greater than or equal to 0.`,
        });
        return;
      }
    }

    const zone = row.zone == null || row.zone === '' ? 0 : Number(row.zone);
    if (!Number.isInteger(zone) || zone < 0) {
      errors.push({ field: `wilayas[${index}].zone`, message: 'Zone must be a whole number ≥ 0.' });
      return;
    }

    byCode.set(wilaya.code, { code: wilaya.code, zone, home, stopDesk });
  });

  if (errors.length) {
    const error = new Error('Please correct the indicated fields.');
    error.status = 400;
    error.code = 'INVALID_TARIFFS';
    error.errors = errors;
    throw error;
  }

  // Keep every wilaya in the document (missing ones stay unpriced).
  const tariffs = WILAYAS.map((wilaya) => byCode.get(wilaya.code) || { code: wilaya.code, zone: 0, home: null, stopDesk: null });

  const doc = await DeliverySettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, extraItemFee: fee, tariffs },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return setCache(doc).settings;
};

/** Clear the in-memory cache (used by tests). */
const clearCache = () => {
  cache = null;
};

module.exports = {
  getTariffIndex,
  getExtraItemFee,
  getPublicSettings,
  updateSettings,
  ensureSeeded,
  clearCache,
  buildDefaultSettings,
};
