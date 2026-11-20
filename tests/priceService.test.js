import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRealPrices, quoteFor, computeBasket } from '../src/services/priceService.js';

// Small fixture in the exact real_prices.json format.
const fixture = {
  lastUpdated: '2026-11-14T03:00:00',
  chainOrder: ['shufersal', 'ramiLevy', 'victory', 'yochananof', 'tivTaam', 'carrefour'],
  chains: [
    { id: 'shufersal', status: 'ok', storeName: 'דיל חולון' },
    { id: 'ramiLevy', status: 'ok' },
    { id: 'victory', status: 'error', error: 'x' },
    { id: 'yochananof', status: 'stale', fileTime: '2026-11-13T03:00:00' },
  ],
  fields: ['barcode', 'name', 'manufacturer', 'unit', 'weighted', 'prices', 'category', 'dictId'],
  products: [
    ['111', 'חלב 3% 1 ל', 'תנובה', '1 ליטר', 0, [7.1, 6.9, null, 7.0, null, null], 'dairy', 'milk'],
    ['222', 'במבה 80 גרם', 'אסם', '80 גרם', 0, [4.9, 3.9, null, null, null, null], 'pantry', 'bamba'],
    ['333', 'רק בשופרסל', '', '', 0, [9.9, null, null, null, null, null], 'other', null],
  ],
};
const db = parseRealPrices(fixture);
const items = [{ id: 'a', qty: 2, barcode: '111' }, { id: 'b', qty: 1, barcode: '222' }, { id: 'c', qty: 1, barcode: null, name: 'משהו' }];
const quotes = Object.fromEntries(items.map((i) => [i.id, quoteFor(db, i)]));

test('parse: chains carry status; prices null when absent', () => {
  assert.equal(db.products.length, 3);
  assert.deepEqual(db.chains.filter((c) => c.hasData).map((c) => c.id), ['shufersal', 'ramiLevy', 'yochananof']);
  const milk = db.byBarcode.get('111');
  assert.equal(milk.prices.ramiLevy, 6.9);
  assert.equal(milk.prices.victory, null);
  assert.equal(milk.prices.carrefour, null);
  assert.equal(milk.chainCount, 3);
  assert.equal(milk.minPrice, 6.9);
});

test('unlinked items get no prices at all', () => {
  assert.equal(quotes.c.linked, false);
  assert.ok(Object.values(quotes.c.prices).every((v) => v === null));
});

test('basket: only chains with every linked item are ranked; no invented prices', () => {
  const b = computeBasket(items, quotes, db.chains);
  assert.equal(b.linkedCount, 2);
  assert.deepEqual(b.unlinked.map((i) => i.id), ['c']);
  assert.deepEqual(b.complete.map((t) => [t.chainId, t.total]), [['ramiLevy', 17.7], ['shufersal', 19.1]]);
  assert.equal(b.cheapest.chainId, 'ramiLevy');
  assert.equal(b.priciest.chainId, 'shufersal');
  assert.equal(b.savings, 1.4);
  const yoch = b.totals.find((t) => t.chainId === 'yochananof');
  assert.equal(yoch.complete, false);
  assert.equal(yoch.missing, 1); // במבה not in its file
  const victory = b.totals.find((t) => t.chainId === 'victory');
  assert.equal(victory.hasData, false);
  assert.equal(b.totals.at(-1).hasData, false); // no-data chains last
});

test('basket with a single complete chain has no savings claim', () => {
  const only = [{ id: 'x', qty: 1, barcode: '333' }];
  const b = computeBasket(only, { x: quoteFor(db, only[0]) }, db.chains);
  assert.equal(b.cheapest.chainId, 'shufersal');
  assert.equal(b.priciest, null);
  assert.equal(b.savings, 0);
});

test('the shipped real_prices.json parses and has real data', () => {
  const real = parseRealPrices(JSON.parse(readFileSync(new URL('../public/real_prices.json', import.meta.url), 'utf8')));
  assert.ok(real.products.length > 1000);
  assert.ok(real.lastUpdated);
  assert.ok(real.chains.some((c) => c.hasData));
  // Real cross-chain comparison: several chains, and products listed in more than one of them.
  assert.ok(real.chains.filter((c) => c.hasData).length >= 2, 'expected 2+ chains with data');
  assert.ok(real.products.some((p) => p.chainCount >= 2));
  // Manufacturer comes through (ManufactureName tag) — brand searches like "מעדנות" depend on it.
  const withMaker = real.products.filter((p) => p.manufacturer).length;
  assert.ok(withMaker > real.products.length * 0.2, `only ${withMaker} products have a manufacturer`);
  assert.ok(real.products.every((p) => !/בע"מ|\\/.test(p.manufacturer)), 'manufacturer not cleaned');
  for (const p of real.products) {
    assert.ok(/^(([a-zA-Z]+:)?\d+|fresh:[a-z-]+)$/.test(p.barcode), p.barcode); // "chain:code" = chain-internal, "fresh:id" = name-matched group
    for (const v of Object.values(p.prices)) assert.ok(v === null || v > 0);
  }
});

test('no complete chain → compare the products every chain with data sells', () => {
  const its = [{ id: 'a', qty: 2, barcode: '111' }, { id: 'b', qty: 1, barcode: '222' }];
  const qs = Object.fromEntries(its.map((i) => [i.id, quoteFor(db, i)]));
  const b = computeBasket(its, qs, db.chains);
  // yochananof lacks במבה → no complete chain among the 3 with data … but ramiLevy+shufersal are complete
  assert.equal(b.cheapest.chainId, 'ramiLevy');
  // common = items priced in ALL data chains (shufersal, ramiLevy, yochananof) → only milk
  assert.equal(b.common.count, 1);
  assert.deepEqual(b.common.totals.map((t) => [t.chainId, t.total]), [['ramiLevy', 13.8], ['yochananof', 14], ['shufersal', 14.2]]);
  assert.equal(b.common.savings, 0.4);
});
