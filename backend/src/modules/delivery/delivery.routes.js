'use strict';

const express = require('express');

const { requireAuth } = require('../../middlewares/auth');
const { getTariffs, updateTariffs, quote } = require('./delivery.controller');

const router = express.Router();

router.get('/tariffs', getTariffs);
router.put('/tariffs', requireAuth, updateTariffs);
router.post('/quote', quote);

module.exports = router;
