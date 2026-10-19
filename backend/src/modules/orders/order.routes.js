const express = require('express');

const { requireAuth } = require('../../middlewares/auth');
const { listOrders, getOrder, createOrder, updateOrderStatus } = require('./order.controller');

const router = express.Router();

router.post('/', createOrder);
router.get('/', requireAuth, listOrders);
router.get('/:id', requireAuth, getOrder);
router.put('/:id/status', requireAuth, updateOrderStatus);

module.exports = router;
