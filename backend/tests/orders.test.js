'use strict';

/**
 * Order creation / quote tests.
 *
 * Real Express routers, controllers, pricing service and Mongoose schemas
 * (validation runs for real). Only the two database round-trips are replaced
 * by an in-memory store, so no MongoDB and no real order is ever created.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const Product = require('../src/modules/products/product.model');
const { Order } = require('../src/modules/orders/order.model');
const deliveryConfig = require('../src/modules/delivery/delivery.config');
const tariffStore = require('../src/modules/delivery/delivery.tariff-store');
const orderRoutes = require('../src/modules/orders/order.routes');
const deliveryRoutes = require('../src/modules/delivery/delivery.routes');

/* ---------------------------- in-memory database --------------------------- */

const catalog = [];
const savedOrders = [];

const makeProduct = (fields) => {
  const product = new Product({
    description: '',
    category: 'Bouquets',
    image: 'https://example.test/img.jpg',
    stock: 10,
    ...fields,
  });
  catalog.push(product);
  return product;
};

Product.find = async (filter) => {
  const clauses = filter.$or || [];
  const wantedIds = new Set();
  const wantedSlugs = new Set();
  clauses.forEach((clause) => {
    if (clause._id) clause._id.$in.forEach((id) => wantedIds.add(String(id)));
    if (clause.slug) clause.slug.$in.forEach((slug) => wantedSlugs.add(slug));
  });
  return catalog.filter((product) => wantedIds.has(String(product._id)) || wantedSlugs.has(product.slug));
};

Order.create = async (doc) => {
  if (savedOrders.some((order) => order.orderReference === doc.orderReference)) {
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  }
  const order = new Order(doc);
  await order.validate(); // real schema validation
  savedOrders.push(order);
  return order;
};

/* --------------------------------- server ---------------------------------- */

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);

let server;
let base;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => {
  catalog.length = 0;
  savedOrders.length = 0;
  deliveryConfig.REQUIRE_PRODUCT_WEIGHTS = false;
  tariffStore.clearCache();
});

const call = async (method, path, body) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};

let counter = 0;
const orderBody = (overrides = {}) => ({
  orderReference: `EV-TEST-${++counter}`,
  customer: { fullName: 'Amina Test', phone: '0551234567', wilaya: 'Alger', wilayaCode: '16' },
  deliveryMethod: 'home',
  paymentMethod: 'cash_on_delivery',
  items: [],
  ...overrides,
});

/* ---------------------------------- tests ---------------------------------- */

test('Alger home delivery: 500 DA, total = subtotal + 500', async () => {
  const rose = makeProduct({ name: 'Rose', slug: 'rose', price: 8500, weightKg: 1 });
  const { status, body } = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'rose', quantity: 1 }] }));

  assert.equal(status, 201);
  assert.equal(body.data.subtotal, 8500);
  assert.equal(body.data.deliveryFee, 500);
  assert.equal(body.data.weightSurcharge, 0);
  assert.equal(body.data.total, 9000);
  assert.equal(body.data.deliveryMethod, 'home');
  assert.equal(body.data.items[0].productId, String(rose._id));
  assert.equal(savedOrders.length, 1);
});

test('Alger Stop-Desk: 450 DA', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({ deliveryMethod: 'stop_desk', items: [{ productId: 'rose', quantity: 1 }] })
  );

  assert.equal(status, 201);
  assert.equal(body.data.deliveryFee, 450);
  assert.equal(body.data.total, 1450);
  assert.equal(body.data.deliveryMethod, 'stop_desk');
});

test('Khenchela: home 850 DA, Stop-Desk 700 DA', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const customer = { fullName: 'Karim Test', phone: '0661234567', wilaya: 'Khenchela', wilayaCode: '40' };

  const home = await call('POST', '/api/orders', orderBody({ customer, items: [{ productId: 'rose', quantity: 1 }] }));
  assert.equal(home.body.data.deliveryFee, 850);
  assert.equal(home.body.data.total, 1850);

  const desk = await call(
    'POST',
    '/api/orders',
    orderBody({ customer, deliveryMethod: 'stop_desk', items: [{ productId: 'rose', quantity: 1 }] })
  );
  assert.equal(desk.body.data.deliveryFee, 700);
  assert.equal(desk.body.data.total, 1700);
});

test('weight: exactly 5 kg has no surcharge; the next band adds 50 DA', async () => {
  makeProduct({ name: 'Pot', slug: 'pot', price: 1000, weightKg: 2.5 });

  const five = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'pot', quantity: 2 }] })); // 5 kg
  assert.equal(five.body.data.weightSurcharge, 0);
  assert.equal(five.body.data.itemSurcharge, 250); // +1 extra item
  assert.equal(five.body.data.total, 2000 + 500 + 250);
  assert.equal(five.body.data.delivery.weightKg, 5);

  const seven = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'pot', quantity: 3 }] })); // 7.5 kg
  assert.equal(seven.body.data.weightSurcharge, 50);
  assert.equal(seven.body.data.itemSurcharge, 500); // +2 extra items
  assert.equal(seven.body.data.total, 3000 + 500 + 500 + 50);
  assert.equal(seven.body.data.delivery.weightBands, 1);

  const eleven = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'pot', quantity: 5 }] })); // 12.5 kg
  assert.equal(eleven.body.data.weightSurcharge, 100);
  assert.equal(eleven.body.data.itemSurcharge, 1000);
});

test('extra item: +250 DA delivery per unit beyond the first', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 0.5 });

  const one = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'rose', quantity: 1 }] }));
  assert.equal(one.body.data.itemSurcharge, 0);
  assert.equal(one.body.data.total, 1000 + 500);

  const three = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'rose', quantity: 3 }] }));
  assert.equal(three.body.data.itemSurcharge, 500);
  assert.equal(three.body.data.total, 3000 + 500 + 500);
  assert.equal(three.body.data.delivery.itemCount, 3);
  assert.equal(three.body.data.delivery.feePerExtraItem, 250);
});

test('the browser cannot set prices: fake unitPrice / subtotal / deliveryFee are ignored', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 8500, weightKg: 1 });
  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({
      items: [{ productId: 'rose', quantity: 2, unitPrice: 1, subtotal: 2, name: 'Hacked', weightKg: 0.001 }],
      subtotal: 2,
      deliveryFee: 0,
      weightSurcharge: 0,
    })
  );

  assert.equal(status, 201);
  assert.equal(body.data.items[0].unitPrice, 8500);
  assert.equal(body.data.items[0].name, 'Rose');
  assert.equal(body.data.items[0].weightKg, 1);
  assert.equal(body.data.subtotal, 17000);
  assert.equal(body.data.deliveryFee, 500);
  assert.equal(body.data.itemSurcharge, 250); // quantity 2
  assert.equal(body.data.total, 17750);
});

test('a total that differs from the server total is refused (409) and nothing is stored', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 8500, weightKg: 1 });
  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({ items: [{ productId: 'rose', quantity: 1 }], total: 8500 }) // forgot delivery
  );

  assert.equal(status, 409);
  assert.equal(body.code, 'PRICE_MISMATCH');
  assert.equal(body.data.total, 9000); // the corrected quote is returned
  assert.equal(savedOrders.length, 0);
});

test('a total that matches the server total is accepted', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 8500, weightKg: 1 });
  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({ items: [{ productId: 'rose', quantity: 1 }], total: 9000 })
  );
  assert.equal(status, 201);
  assert.equal(body.data.total, 9000);
});

test('the displayed quote and the stored order always agree', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 3333, weightKg: 1.7 });
  const request = orderBody({
    customer: { fullName: 'Sara Test', phone: '0771234567', wilaya: 'Adrar', wilayaCode: '01' },
    deliveryMethod: 'stop_desk',
    items: [{ productId: 'rose', quantity: 4 }], // 6.8 kg
  });

  const quote = await call('POST', '/api/delivery/quote', {
    items: request.items,
    wilayaCode: '01',
    deliveryMethod: 'stop_desk',
  });
  const order = await call('POST', '/api/orders', { ...request, total: quote.body.data.total });

  assert.equal(quote.body.data.deliveryFee, 1150);
  assert.equal(quote.body.data.weightSurcharge, 50);
  assert.equal(quote.body.data.itemSurcharge, 750); // quantity 4
  assert.equal(order.status, 201);
  assert.equal(order.body.data.total, quote.body.data.total);
  assert.equal(order.body.data.deliveryFee, quote.body.data.deliveryFee);
  assert.equal(order.body.data.weightSurcharge, quote.body.data.weightSurcharge);
  assert.equal(order.body.data.itemSurcharge, quote.body.data.itemSurcharge);
});

test('products can be referenced by Mongo _id or by slug; duplicates are merged', async () => {
  const rose = makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({
      items: [
        { productId: 'rose', quantity: 1 },
        { productId: String(rose._id), quantity: 2 },
      ],
    })
  );
  assert.equal(status, 201);
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].quantity, 3);
  assert.equal(body.data.subtotal, 3000);
});

test('unknown / inactive products and bad quantities are rejected', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  makeProduct({ name: 'Old', slug: 'old', price: 1000, weightKg: 1, isActive: false });

  const unknown = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'nope', quantity: 1 }] }));
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.errors[0].field, 'items[0].productId');

  const inactive = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'old', quantity: 1 }] }));
  assert.equal(inactive.status, 400);

  for (const quantity of [0, -1, 1.5, 100, 'abc', null]) {
    const bad = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'rose', quantity }] }));
    assert.equal(bad.status, 400, `quantity ${quantity}`);
  }

  const injection = await call(
    'POST',
    '/api/orders',
    orderBody({ items: [{ productId: { $ne: '' }, quantity: 1 }] })
  );
  assert.equal(injection.status, 400);

  const empty = await call('POST', '/api/orders', orderBody({ items: [] }));
  assert.equal(empty.status, 400);
  assert.equal(savedOrders.length, 0);
});

test('a wilaya with no configured tariff cannot be ordered (no fabricated price)', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({
      customer: { fullName: 'Test Touggourt', phone: '0551234567', wilaya: 'Touggourt', wilayaCode: '55' },
      items: [{ productId: 'rose', quantity: 1 }],
    })
  );
  assert.equal(status, 422);
  assert.equal(body.code, 'DELIVERY_TARIFF_UNAVAILABLE');
  assert.match(body.message, /Touggourt/);
  assert.equal(savedOrders.length, 0);
});

test('unknown wilaya code and invalid delivery method are rejected', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const items = [{ productId: 'rose', quantity: 1 }];

  const badWilaya = await call(
    'POST',
    '/api/orders',
    orderBody({ items, customer: { fullName: 'Test User', phone: '0551234567', wilaya: 'X', wilayaCode: '99' } })
  );
  assert.equal(badWilaya.status, 400);

  const badMethod = await call('POST', '/api/orders', orderBody({ items, deliveryMethod: 'drone' }));
  assert.equal(badMethod.status, 400);
  assert.equal(badMethod.body.errors[0].field, 'deliveryMethod');
});

test('required customer fields are still validated', async () => {
  const { status, body } = await call('POST', '/api/orders', {
    orderReference: '',
    customer: { fullName: 'A', phone: '', wilaya: '' },
    items: [],
  });
  assert.equal(status, 400);
  const fields = body.errors.map((error) => error.field);
  ['customer.fullName', 'customer.phone', 'customer.wilaya', 'orderReference', 'items'].forEach((field) =>
    assert.ok(fields.includes(field), field)
  );
});

test('older clients (wilaya name only, no delivery method, no total) still work', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { status, body } = await call('POST', '/api/orders', {
    orderReference: 'EV-OLDCLIENT-1',
    customer: { fullName: 'Old Client', phone: '0551234567', wilaya: 'Oran' },
    items: [{ productId: 'rose', quantity: 1 }],
    subtotal: 1000,
    deliveryFee: 0,
    total: undefined,
  });
  assert.equal(status, 201);
  assert.equal(body.data.customer.wilayaCode, '31');
  assert.equal(body.data.deliveryMethod, 'home');
  assert.equal(body.data.deliveryFee, 850);
});

test('a public checkout cannot create an order in a later status', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { body } = await call(
    'POST',
    '/api/orders',
    orderBody({ items: [{ productId: 'rose', quantity: 1 }], status: 'livree' })
  );
  assert.equal(body.data.status, 'nouvelle');
});

test('the optional address is stored; the stored order keeps a reproducible snapshot', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 3 });
  const { body } = await call(
    'POST',
    '/api/orders',
    orderBody({
      customer: {
        fullName: 'Amina Test',
        phone: '0551234567',
        wilaya: 'Alger',
        wilayaCode: '16',
        address: '12 rue des Jardins, Hydra',
      },
      items: [{ productId: 'rose', quantity: 3 }], // 9 kg
    })
  );
  const order = body.data;
  assert.equal(order.customer.address, '12 rue des Jardins, Hydra');
  assert.equal(order.customer.wilayaCode, '16');
  assert.equal(order.delivery.zone, 0);
  assert.equal(order.delivery.weightKg, 9);
  assert.equal(order.delivery.weightComplete, true);
  assert.deepEqual(order.delivery.weightRule, { freeKg: 5, stepKg: 5, feePerStep: 50 });
  assert.equal(
    order.subtotal + order.deliveryFee + order.itemSurcharge + order.weightSurcharge,
    order.total
  );
});

test('missing product weights: nothing is invented, the order is accepted and flagged', async () => {
  makeProduct({ name: 'Known', slug: 'known', price: 1000, weightKg: 2 });
  makeProduct({ name: 'Unknown', slug: 'unknown', price: 1000 }); // no weight recorded

  const { status, body } = await call(
    'POST',
    '/api/orders',
    orderBody({
      items: [
        { productId: 'known', quantity: 1 },
        { productId: 'unknown', quantity: 1 },
      ],
    })
  );
  assert.equal(status, 201);
  assert.equal(body.data.delivery.weightKg, 2); // only the known weight
  assert.equal(body.data.delivery.weightComplete, false);
  assert.equal(body.data.delivery.missingWeightProducts[0].name, 'Unknown');
  assert.equal(body.data.items.find((item) => item.name === 'Unknown').weightKg, null);
  assert.equal(body.data.weightSurcharge, 0);
});

test('DELIVERY_REQUIRE_PRODUCT_WEIGHTS=true refuses orders with unweighed products', async () => {
  deliveryConfig.REQUIRE_PRODUCT_WEIGHTS = true;
  makeProduct({ name: 'Unknown', slug: 'unknown', price: 1000 });

  const { status, body } = await call('POST', '/api/orders', orderBody({ items: [{ productId: 'unknown', quantity: 1 }] }));
  assert.equal(status, 422);
  assert.equal(body.code, 'PRODUCT_WEIGHT_MISSING');
  assert.equal(savedOrders.length, 0);
});

test('duplicate order reference still returns 409 (existing behaviour)', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const request = orderBody({ items: [{ productId: 'rose', quantity: 1 }] });
  assert.equal((await call('POST', '/api/orders', request)).status, 201);
  const again = await call('POST', '/api/orders', request);
  assert.equal(again.status, 409);
});

/* --------------------------------- quote API -------------------------------- */

test('quote without a wilaya: server prices the cart and asks for a wilaya', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { status, body } = await call('POST', '/api/delivery/quote', { items: [{ productId: 'rose', quantity: 2 }] });
  assert.equal(status, 200);
  assert.equal(body.data.subtotal, 2000);
  assert.equal(body.data.available, false);
  assert.equal(body.data.reason, 'WILAYA_REQUIRED');
  assert.equal(body.data.total, null);
});

test('quote for an unpriced wilaya reports TARIFF_UNAVAILABLE and no price', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const { body } = await call('POST', '/api/delivery/quote', {
    items: [{ productId: 'rose', quantity: 1 }],
    wilayaCode: '49',
  });
  assert.equal(body.data.available, false);
  assert.equal(body.data.reason, 'TARIFF_UNAVAILABLE');
  assert.equal(body.data.deliveryFee, null);
  assert.equal(body.data.total, null);
});

test('changing wilaya or method changes the quote; both methods are previewed', async () => {
  makeProduct({ name: 'Rose', slug: 'rose', price: 1000, weightKg: 1 });
  const items = [{ productId: 'rose', quantity: 1 }];
  const quote = async (wilayaCode, deliveryMethod) =>
    (await call('POST', '/api/delivery/quote', { items, wilayaCode, deliveryMethod })).body.data;

  const algerHome = await quote('16', 'home');
  const algerDesk = await quote('16', 'stop_desk');
  const khenchelaHome = await quote('40', 'home');
  const khenchelaDesk = await quote('40', 'stop_desk');

  assert.deepEqual([algerHome.deliveryFee, algerDesk.deliveryFee, khenchelaHome.deliveryFee, khenchelaDesk.deliveryFee], [
    500, 450, 850, 700,
  ]);
  assert.deepEqual(algerHome.options, { home: 500, stop_desk: 450 });
  assert.equal(khenchelaDesk.total, 1700);
});

test('GET /api/delivery/tariffs exposes 58 wilayas, 10 unpriced, weight rule and extra-item fee', async () => {
  const { body } = await call('GET', '/api/delivery/tariffs');
  assert.equal(body.data.wilayas.length, 58);
  assert.equal(body.data.wilayas.filter((wilaya) => !wilaya.available).length, 10);
  assert.deepEqual(body.data.unconfiguredWilayas, ['49', '50', '51', '52', '53', '54', '55', '56', '57', '58']);
  assert.deepEqual(body.data.weightRule, { freeKg: 5, stepKg: 5, feePerStep: 50 });
  assert.equal(body.data.extraItemFee, 250);
  const alger = body.data.wilayas.find((wilaya) => wilaya.code === '16');
  assert.deepEqual([alger.home, alger.stopDesk, alger.zone], [500, 450, 0]);
});

/* ------------------------ models & historical orders ------------------------ */

test('historical orders (no delivery fields) keep their stored totals untouched', () => {
  const legacy = Order.hydrate({
    _id: new mongoose.Types.ObjectId(),
    orderReference: 'EV-20260101-OLD1',
    customer: { fullName: 'Old Customer', phone: '0555000000', wilaya: 'Oran' },
    items: [{ name: 'Bouquet', quantity: 1, unitPrice: 5800, subtotal: 5800 }],
    subtotal: 5800,
    deliveryFee: 0,
    total: 5800,
  }).toJSON();

  assert.equal(legacy.total, 5800);
  assert.equal(legacy.deliveryFee, 0);
  assert.equal(legacy.weightSurcharge, undefined); // not invented
  assert.equal(legacy.delivery, undefined);
  assert.equal(legacy.customer.wilayaCode, undefined);
  assert.equal(legacy.deliveryMethod, 'home');
});

test('product weight validation: optional, > 0, gram precision', async () => {
  const check = async (weightKg) =>
    new Product({ name: 'P', category: 'C', price: 10, image: 'x', stock: 1, weightKg })
      .validate()
      .then(() => true)
      .catch(() => false);

  assert.equal(await check(undefined), true); // not recorded
  assert.equal(await check(2.5), true);
  assert.equal(await check(0.001), true);
  assert.equal(await check(0), false);
  assert.equal(await check(-1), false);
  assert.equal(await check(1.2345), false);

  const none = new Product({ name: 'P', category: 'C', price: 10, image: 'x', stock: 1 });
  assert.equal(none.weightKg, undefined); // never defaulted to a made-up weight
});
