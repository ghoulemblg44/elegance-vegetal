const jwt = require('jsonwebtoken');

const config = require('../config');
const Admin = require('../modules/users/admin.model');

const sendUnauthorized = (res, message) =>
  res.status(401).json({
    status: 'error',
    message,
  });

const publicAdmin = (admin) => ({
  id: String(admin._id),
  email: admin.email,
  role: admin.role,
});

const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return sendUnauthorized(res, 'Authentication token is missing.');
  }

  if (!config.jwtSecret) {
    return res.status(500).json({
      status: 'error',
      message: 'Authentication is not configured.',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const admin = await Admin.findById(payload.sub);

    if (!admin) {
      return sendUnauthorized(res, 'Invalid or expired authentication token.');
    }

    req.admin = publicAdmin(admin);
    return next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired authentication token.');
  }
};

module.exports = {
  requireAuth,
  publicAdmin,
};
