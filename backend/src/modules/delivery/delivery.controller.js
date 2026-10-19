'use strict';

const { PricingError, priceOrder } = require('./delivery.service');
const tariffStore = require('./delivery.tariff-store');

const sendError = (res, status, message, extra = {}) =>
  res.status(status).json({ status: 'error', message, ...extra });

const handleError = (res, error) => {
  if (error instanceof PricingError) {
    return sendError(res, error.status, error.message, {
      code: error.code,
      ...(error.errors.length ? { errors: error.errors } : {}),
    });
  }
  if (error.status) {
    return sendError(res, error.status, error.message, {
      code: error.code,
      ...(error.errors ? { errors: error.errors } : {}),
    });
  }
  console.error(error.message);
  return sendError(res, 500, 'An unexpected error occurred.');
};

/**
 * GET /api/delivery/tariffs
 * Public, read-only view of the tariff configuration (no secrets in it):
 * every wilaya with its zone and fees (null = tariff still to be confirmed),
 * plus the weight / extra-item rules.
 */
const getTariffs = async (_req, res) => {
  try {
    const data = await tariffStore.getPublicSettings();
    return res.status(200).json({ status: 'ok', data });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * PUT /api/delivery/tariffs  (admin)
 * Body: { extraItemFee?, wilayas: [{ code, zone?, home, stopDesk }] }
 */
const updateTariffs = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = await tariffStore.updateSettings({
      extraItemFee: body.extraItemFee,
      wilayas: body.wilayas,
    });
    return res.status(200).json({ status: 'ok', message: 'Tarifs de livraison mis à jour.', data });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * POST /api/delivery/quote
 * Body: { items: [{ productId, quantity }], wilayaCode?, deliveryMethod? }
 * Returns the authoritative quote the checkout displays. A missing/unpriced
 * wilaya is not an error: the quote says `available: false` and why.
 */
const quote = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await priceOrder({
      items: body.items,
      wilayaCode: body.wilayaCode,
      deliveryMethod: body.deliveryMethod,
    });
    return res.status(200).json({ status: 'ok', data: result });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { getTariffs, updateTariffs, quote };
