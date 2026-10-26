'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const config = require('../src/modules/delivery/delivery.config');
const { WILAYAS, findWilaya } = require('../src/modules/delivery/delivery.wilayas');
const calc = require('../src/modules/delivery/delivery.calculator');

const fee = (code, method, kg = 0) =>
  calc.calculateDelivery({ wilayaCode: code, deliveryMethod: method, totalWeightKg: kg });

/* -------------------------------------------------------------------------- */
/* Wilayas                                                                    */
/* -------------------------------------------------------------------------- */

test('backend wilaya list is identical to the checkout selector list (58 wilayas)', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/js/wilayas.js'), 'utf8');
  // JSON round-trip: objects from a vm context have a foreign Array prototype.
  const frontend = JSON.parse(JSON.stringify(vm.runInNewContext(`${source};WILAYAS`)));

  assert.equal(WILAYAS.length, 58);
  assert.deepEqual(
    WILAYAS.map(({ code, name }) => ({ code, name })),
    frontend
  );
});

test('findWilaya resolves by code (preferred) and by accent/case-insensitive name', () => {
  assert.equal(findWilaya({ code: '16' }).name, 'Alger');
  assert.equal(findWilaya({ code: '9' }).name, 'Blida'); // un-padded code
  assert.equal(findWilaya({ name: "m'sila" }).code, '28');
  assert.equal(findWilaya({ name: 'AIN TEMOUCHENT' }).code, '46');
  assert.equal(findWilaya({ code: '99' }), null);
  assert.equal(findWilaya({ name: 'Atlantis' }), null);
  assert.equal(findWilaya({}), null);
});

/* -------------------------------------------------------------------------- */
/* Tariffs                                                                    */
/* -------------------------------------------------------------------------- */

test('Alger: home 500 DA, Stop-Desk 450 DA', () => {
  assert.equal(fee('16', 'home').baseFee, 500);
  assert.equal(fee('16', 'stop_desk').baseFee, 450);
  assert.equal(fee('16', 'home').zone, 0);
});

test('Khenchela: home 850 DA, Stop-Desk 700 DA', () => {
  assert.equal(fee('40', 'home').baseFee, 850);
  assert.equal(fee('40', 'stop_desk').baseFee, 700);
});

test('every supplied tariff row is applied exactly as supplied', () => {
  assert.equal(config.SUPPLIED_TARIFF_TABLE.length, 48);

  config.SUPPLIED_TARIFF_TABLE.forEach((row) => {
    const wilaya = findWilaya({ name: row.destination });
    assert.ok(wilaya, `${row.destination} must match a wilaya`);
    const home = fee(wilaya.code, 'home');
    const desk = fee(wilaya.code, 'stop_desk');
    assert.equal(home.baseFee, row.home, `${row.destination} home`);
    assert.equal(desk.baseFee, row.stopDesk, `${row.destination} stop-desk`);
    assert.equal(home.zone, row.zone, `${row.destination} zone`);
  });
});

test('spot-check one wilaya of each zone against the supplied table', () => {
  const expected = [
    ['09', 'Blida', 650, 600],
    ['03', 'Laghouat', 1000, 850],
    ['01', 'Adrar', 1450, 1150],
    ['33', 'Illizi', 1650, 1550],
  ];
  expected.forEach(([code, , home, desk]) => {
    assert.equal(fee(code, 'home').baseFee, home);
    assert.equal(fee(code, 'stop_desk').baseFee, desk);
  });
});

test('the 10 wilayas missing from the supplied table have NO price (never invented)', () => {
  const missing = calc.listUnconfiguredWilayas();
  assert.deepEqual(
    missing.map((wilaya) => wilaya.code),
    ['49', '50', '51', '52', '53', '54', '55', '56', '57', '58']
  );

  missing.forEach((wilaya) => {
    const result = fee(wilaya.code, 'home');
    assert.equal(result.available, false);
    assert.equal(result.reason, 'TARIFF_UNAVAILABLE');
    assert.equal(result.baseFee, undefined);
  });
});

test('48 priced + 10 unpriced = 58 wilayas', () => {
  const priced = WILAYAS.filter((wilaya) => calc.getTariff(wilaya.code));
  assert.equal(priced.length, 48);
  assert.equal(priced.length + calc.listUnconfiguredWilayas().length, 58);
});

test('no wilaya / unknown delivery method are reported, not priced', () => {
  assert.equal(fee('', 'home').reason, 'WILAYA_REQUIRED');
  assert.equal(fee('16', 'drone').reason, 'INVALID_METHOD');
});

test('delivery method normalisation (missing = home, aliases accepted, junk rejected)', () => {
  assert.equal(calc.normalizeDeliveryMethod(undefined), 'home');
  assert.equal(calc.normalizeDeliveryMethod(''), 'home');
  assert.equal(calc.normalizeDeliveryMethod('home'), 'home');
  assert.equal(calc.normalizeDeliveryMethod('stop_desk'), 'stop_desk');
  assert.equal(calc.normalizeDeliveryMethod('Stop-Desk'), 'stop_desk');
  assert.equal(calc.normalizeDeliveryMethod('drone'), null);
});

test('tariff index refuses an inconsistent configuration', () => {
  const row = { destination: 'Alger', zone: 0, home: 500, stopDesk: 450 };
  assert.throws(() => calc.buildTariffIndex([[row, row]]), /defined twice/);
  assert.throws(() => calc.buildTariffIndex([[{ ...row, destination: 'Narnia' }]]), /does not match any wilaya/);
  assert.throws(() => calc.buildTariffIndex([[{ ...row, home: -1 }]]), /invalid/);
});

/* -------------------------------------------------------------------------- */
/* Weight surcharge (default rule: free 5 kg, +50 DA per started 5 kg)         */
/* -------------------------------------------------------------------------- */

const surcharge = (kg, rule) => calc.calculateWeightSurcharge(kg, rule).surcharge;

test('up to and including 5 kg: no surcharge', () => {
  [0, 0.5, 4.999, 5].forEach((kg) => assert.equal(surcharge(kg), 0, `${kg} kg`));
});

test('more than 5 kg and up to 10 kg: +50 DA', () => {
  [5.001, 7.5, 10].forEach((kg) => assert.equal(surcharge(kg), 50, `${kg} kg`));
});

test('more than 10 kg and up to 15 kg: +100 DA, then +50 DA per further band', () => {
  assert.equal(surcharge(10.001), 100);
  assert.equal(surcharge(15), 100);
  assert.equal(surcharge(15.001), 150);
  assert.equal(surcharge(20), 150);
  assert.equal(surcharge(20.001), 200);
  assert.equal(surcharge(100), 950);
});

test('weights are never rounded down: a few grams over a limit starts the next band', () => {
  assert.equal(surcharge(5.0004), 50);
  assert.equal(surcharge(10.000001), 100);
});

test('floating-point noise does not create a false surcharge', () => {
  assert.equal(surcharge(2.3 + 2.7), 0); // 5.000000000000001
  assert.equal(surcharge(0.1 + 0.2 + 4.7), 0);
  assert.equal(surcharge(1.1 * 3 + 6.7), 50); // 10.000000000000002 is still 10 kg -> 1 band
});

test('the rule is configurable (free kg, step kg, fee per step)', () => {
  const rule = { freeKg: 2, stepKg: 3, feePerStep: 80 };
  assert.equal(surcharge(2, rule), 0);
  assert.equal(surcharge(2.1, rule), 80);
  assert.equal(surcharge(5, rule), 80);
  assert.equal(surcharge(5.1, rule), 160);
});

test('weight rule is read from environment variables, with safe defaults', () => {
  assert.deepEqual({ ...config.loadWeightRule({}) }, { freeKg: 5, stepKg: 5, feePerStep: 50 });
  assert.deepEqual(
    { ...config.loadWeightRule({ DELIVERY_WEIGHT_FREE_KG: '3', DELIVERY_WEIGHT_STEP_KG: '2', DELIVERY_WEIGHT_STEP_FEE: '40' }) },
    { freeKg: 3, stepKg: 2, feePerStep: 40 }
  );
  assert.throws(() => config.loadWeightRule({ DELIVERY_WEIGHT_STEP_KG: '0' }), /Invalid delivery configuration/);
  assert.throws(() => config.loadWeightRule({ DELIVERY_WEIGHT_STEP_FEE: 'abc' }), /Invalid delivery configuration/);
});

test('invalid weights are rejected rather than silently priced', () => {
  assert.throws(() => calc.calculateWeightSurcharge(-1), RangeError);
  assert.throws(() => calc.calculateWeightSurcharge(NaN), RangeError);
  assert.throws(() => calc.calculateWeightSurcharge('abc'), RangeError);
});

/* -------------------------------------------------------------------------- */
/* Shipment weight                                                            */
/* -------------------------------------------------------------------------- */

test('shipment weight = sum of unit weight x quantity; unknown weights are reported, not invented', () => {
  const full = calc.sumWeight([
    { productId: 'a', name: 'A', quantity: 2, weightKg: 1.25 },
    { productId: 'b', name: 'B', quantity: 3, weightKg: 0.5 },
  ]);
  assert.deepEqual(full, { totalKg: 4, complete: true, missing: [] });

  const partial = calc.sumWeight([
    { productId: 'a', name: 'A', quantity: 2, weightKg: 1.25 },
    { productId: 'b', name: 'B', quantity: 1, weightKg: null },
    { productId: 'c', name: 'C', quantity: 1, weightKg: undefined },
  ]);
  assert.equal(partial.totalKg, 2.5);
  assert.equal(partial.complete, false);
  assert.deepEqual(
    partial.missing.map((entry) => entry.productId),
    ['b', 'c']
  );
});

test('delivery price = base fee + weight surcharge (+ item surcharge when provided)', () => {
  // Alger, home, 6 kg, 1 item -> 500 + 50 + 0
  const result = fee('16', 'home', 6);
  assert.equal(result.baseFee, 500);
  assert.equal(result.weightSurcharge, 50);
  assert.equal(result.itemSurcharge, 0);
  assert.equal(result.deliveryTotal, 550);

  // Khenchela, stop-desk, 12 kg -> 700 + 100
  const far = fee('40', 'stop_desk', 12);
  assert.equal(far.deliveryTotal, 800);

  // Alger, home, 0 kg, 3 items -> 500 + 0 + 2*250
  const multi = calc.calculateDelivery({
    wilayaCode: '16',
    deliveryMethod: 'home',
    totalWeightKg: 0,
    itemCount: 3,
  });
  assert.equal(multi.itemSurcharge, 500);
  assert.equal(multi.deliveryTotal, 1000);
});

test('extra-item surcharge: first unit free, +250 DA per additional unit', () => {
  assert.equal(calc.calculateItemSurcharge(0).surcharge, 0);
  assert.equal(calc.calculateItemSurcharge(1).surcharge, 0);
  assert.equal(calc.calculateItemSurcharge(2).surcharge, 250);
  assert.equal(calc.calculateItemSurcharge(5).surcharge, 1000);
  assert.equal(calc.calculateItemSurcharge(3, 80).surcharge, 160);
  assert.throws(() => calc.calculateItemSurcharge(-1), RangeError);
});

test('extra-item fee is readable from environment variables', () => {
  assert.equal(config.loadExtraItemFee({}), 250);
  assert.equal(config.loadExtraItemFee({ DELIVERY_EXTRA_ITEM_FEE: '75' }), 75);
  assert.equal(config.loadExtraItemFee({ DELIVERY_EXTRA_ITEM_FEE: '0' }), 0);
  assert.throws(() => config.loadExtraItemFee({ DELIVERY_EXTRA_ITEM_FEE: '-1' }), /Invalid delivery configuration/);
});
