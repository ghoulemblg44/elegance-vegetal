const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../../config');
const Admin = require('../users/admin.model');
const { publicAdmin } = require('../../middlewares/auth');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const createToken = (admin) =>
  jwt.sign({ sub: String(admin._id), role: admin.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

const login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const errors = [];

    if (!EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'email', message: 'Enter a valid email address.' });
    }
    if (!password) {
      errors.push({ field: 'password', message: 'Password is required.' });
    }

    if (errors.length) {
      return sendError(res, 400, 'Please correct the indicated fields.', errors);
    }

    if (!config.jwtSecret) {
      return sendError(res, 500, 'Authentication is not configured.');
    }

    const admin = await Admin.findOne({ email }).select('+passwordHash');
    if (!admin) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    return sendOk(
      res,
      200,
      {
        token: createToken(admin),
        admin: publicAdmin(admin),
      },
      'Signed in.'
    );
  } catch (error) {
    console.error(error.message);
    return sendError(res, 500, 'An unexpected error occurred.');
  }
};

const me = async (req, res) => sendOk(res, 200, req.admin);

const logout = async (_req, res) =>
  sendOk(res, 200, undefined, 'Signed out. Discard the authentication token on the client.');

module.exports = {
  login,
  me,
  logout,
};
