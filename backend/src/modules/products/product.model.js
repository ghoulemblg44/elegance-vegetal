const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required.'],
      trim: true,
      minlength: [1, 'Product name cannot be empty.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Product category is required.'],
      trim: true,
      minlength: [1, 'Product category cannot be empty.'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required.'],
      min: [0.01, 'Product price must be greater than 0.'],
    },
    oldPrice: {
      type: Number,
      default: undefined,
      validate: {
        validator: (value) => value == null || value > 0,
        message: 'Previous price must be greater than 0 when provided.',
      },
    },
    image: {
      type: String,
      required: [true, 'Product image is required.'],
      trim: true,
      minlength: [1, 'Product image cannot be empty.'],
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    story: {
      type: String,
      trim: true,
      default: '',
    },
    alt: {
      type: String,
      trim: true,
      default: '',
    },
    availability: {
      type: String,
      trim: true,
    },
    availabilityLabel: {
      type: String,
      trim: true,
    },
    weightKg: {
      // Unit weight in kilograms, used for the delivery weight surcharge.
      // Optional and never defaulted: a missing weight means "not recorded yet".
      type: Number,
      default: undefined,
      min: [0.001, 'Product weight must be greater than 0 kg when provided.'],
      validate: {
        validator: (value) => value == null || Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6,
        message: 'Product weight can have at most 3 decimals (gram precision).',
      },
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative.'],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
