const mongoose = require('mongoose');

const Product = require('./product.model');

const LOW_STOCK_THRESHOLD = 5;

const PRODUCT_FIELDS = [
  'name',
  'description',
  'category',
  'price',
  'oldPrice',
  'weightKg',
  'image',
  'stock',
  'isActive',
];

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const pickProductFields = (body = {}) => {
  const payload = {};

  PRODUCT_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });

  if (payload.oldPrice === '' || payload.oldPrice === null) {
    payload.oldPrice = undefined;
  }

  if (payload.weightKg === '' || payload.weightKg === null) {
    payload.weightKg = undefined;
  }

  return payload;
};

const parseActive = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return null;
};

const handleError = (res, error) => {
  if (error.name === 'ValidationError') {
    return sendError(res, 400, 'Please correct the indicated fields.', mongooseErrors(error));
  }
  if (error.name === 'CastError') {
    return sendError(res, 400, 'Invalid product id.');
  }
  console.error(error.message);
  return sendError(res, 500, 'An unexpected error occurred.');
};

const listProducts = async (req, res) => {
  try {
    const { search, category, active, lowStock } = req.query;
    const filter = {};

    if (search && String(search).trim()) {
      const query = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: query }, { description: query }, { category: query }];
    }

    if (category && String(category).trim()) {
      filter.category = String(category).trim();
    }

    const isActive = parseActive(active);
    if (active !== undefined && isActive === null) {
      return sendError(res, 400, 'Query parameter "active" must be true or false.');
    }
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (lowStock === 'true' || lowStock === '1') {
      filter.stock = { $gt: 0, $lte: LOW_STOCK_THRESHOLD };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    return sendOk(res, 200, products);
  } catch (error) {
    return handleError(res, error);
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return sendError(res, 400, 'Invalid product id.');
    }

    const product = await Product.findById(id);
    if (!product) {
      return sendError(res, 404, 'Product not found.');
    }

    return sendOk(res, 200, product);
  } catch (error) {
    return handleError(res, error);
  }
};

const createProduct = async (req, res) => {
  try {
    const product = await Product.create(pickProductFields(req.body));
    return sendOk(res, 201, product, 'Product created.');
  } catch (error) {
    return handleError(res, error);
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return sendError(res, 400, 'Invalid product id.');
    }

    const product = await Product.findById(id);
    if (!product) {
      return sendError(res, 404, 'Product not found.');
    }

    const updates = pickProductFields(req.body);
    Object.assign(product, updates);

    if (req.body.oldPrice === null || req.body.oldPrice === '') {
      product.oldPrice = undefined;
    }

    if (req.body.weightKg === null || req.body.weightKg === '') {
      product.weightKg = undefined;
    }

    await product.save();
    return sendOk(res, 200, product, 'Product updated.');
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return sendError(res, 400, 'Invalid product id.');
    }

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return sendError(res, 404, 'Product not found.');
    }

    return sendOk(res, 200, product, 'Product deleted.');
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
