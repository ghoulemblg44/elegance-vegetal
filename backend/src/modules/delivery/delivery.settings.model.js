'use strict';

const mongoose = require('mongoose');

const tariffRowSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    zone: { type: Number, default: 0 },
    home: { type: Number, min: 0, default: null },
    stopDesk: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

/**
 * Singleton document holding editable delivery tariffs (one row per wilaya)
 * and the global extra-item fee. Seeded from delivery.config on first use.
 */
const deliverySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'delivery' },
    extraItemFee: { type: Number, min: 0, default: 50 },
    tariffs: { type: [tariffRowSchema], default: [] },
  },
  { timestamps: true }
);

const DeliverySettings = mongoose.model('DeliverySettings', deliverySettingsSchema);

module.exports = DeliverySettings;
