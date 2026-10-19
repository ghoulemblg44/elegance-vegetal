const mongoose = require('mongoose');

const ORDER_STATUSES = ['nouvelle', 'confirmee', 'preparation', 'expediee', 'livree', 'annulee'];

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    image: { type: String, trim: true, default: '' },
    // Unit weight (kg) at the time of the order; null when it was not recorded.
    weightKg: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

/**
 * Snapshot of how the delivery price was computed, so any order can be
 * re-checked later even if tariffs or product weights change.
 * No defaults on purpose: orders created before delivery pricing existed
 * simply have no `delivery` object, which Admin shows as "Non renseigné".
 */
const deliverySnapshotSchema = new mongoose.Schema(
  {
    zone: { type: Number },
    weightKg: { type: Number, min: 0 },
    weightComplete: { type: Boolean },
    missingWeightProducts: [
      new mongoose.Schema(
        {
          productId: { type: String, trim: true },
          name: { type: String, trim: true },
        },
        { _id: false }
      ),
    ],
    weightBands: { type: Number, min: 0 },
    weightRule: {
      freeKg: { type: Number },
      stepKg: { type: Number },
      feePerStep: { type: Number },
    },
    itemCount: { type: Number, min: 0 },
    extraItems: { type: Number, min: 0 },
    feePerExtraItem: { type: Number, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderReference: {
      type: String,
      required: [true, 'Order reference is required.'],
      trim: true,
      unique: true,
    },
    customer: {
      fullName: {
        type: String,
        required: [true, 'Customer full name is required.'],
        trim: true,
        minlength: [3, 'Customer full name is too short.'],
      },
      phone: {
        type: String,
        required: [true, 'Customer phone is required.'],
        trim: true,
      },
      wilaya: {
        type: String,
        required: [true, 'Customer wilaya is required.'],
        trim: true,
      },
      // Official wilaya code ("01"–"58"); absent on orders created before delivery pricing.
      wilayaCode: { type: String, trim: true },
      // Optional free-text delivery address.
      address: { type: String, trim: true, maxlength: [300, 'Address is too long.'] },
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item.',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    // Base delivery tariff for the wilaya + method (excludes item/weight surcharges).
    deliveryFee: { type: Number, default: 0, min: 0 },
    // +50 DA (configurable) per unit beyond the first. Undefined on older orders.
    itemSurcharge: { type: Number, min: 0 },
    // Weight surcharge. No default: undefined means "order predates weight pricing".
    weightSurcharge: { type: Number, min: 0 },
    // subtotal + deliveryFee + itemSurcharge + weightSurcharge (computed by the server).
    total: { type: Number, required: true, min: 0 },
    delivery: { type: deliverySnapshotSchema },
    paymentMethod: { type: String, default: 'cash_on_delivery', trim: true },
    deliveryMethod: { type: String, default: 'home', trim: true },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'nouvelle',
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customer.phone': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = {
  Order,
  ORDER_STATUSES,
};
