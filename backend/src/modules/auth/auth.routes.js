const express = require('express');

const { requireAuth } = require('../../middlewares/auth');
const { login, me, logout } = require('./auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
