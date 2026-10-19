'use strict';

/**
 * Vercel serverless entry for the Express API.
 * All /api/* requests are rewritten here.
 */

const path = require('path');

// Load backend/.env when present (local `vercel dev`); on Vercel, use dashboard env vars.
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const app = require('../backend/src/app');
const { connectDatabase } = require('../backend/src/config/database');
const tariffStore = require('../backend/src/modules/delivery/delivery.tariff-store');

let readyPromise = null;

const ensureReady = () => {
  if (!readyPromise) {
    readyPromise = (async () => {
      await connectDatabase();
      await tariffStore.ensureSeeded();
    })();
  }
  return readyPromise;
};

module.exports = async (req, res) => {
  await ensureReady();
  return app(req, res);
};
