import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../src/data/products.mock.js';
import { CHAINS } from '../src/data/chains.js';
import { CATEGORY_BY_ID } from '../src/data/categories.js';

test('catalog has 550+ products across all departments', () => {
  assert.ok(PRODUCTS.length >= 550, `only ${PRODUCTS.length}`);
  for (const cat of ['produce', 'bakery', 'meat', 'dairy', 'pantry', 'cleaning', 'frozen']) {
    assert.ok(PRODUCTS.some((p) => p.category === cat), cat);
  }
});

test('ids unique, categories valid, every product has a subcategory', () => {
  const ids = new Set();
  for (const p of PRODUCTS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(CATEGORY_BY_ID[p.category], `${p.id}: bad category`);
    assert.ok(p.sub, `${p.id}: no sub`);
  }
});

test('no name/alias is shared by two products', () => {
  const owner = {};
  for (const p of PRODUCTS) {
    for (const label of new Set([p.name, ...p.aliases])) {
      assert.ok(!owner[label] || owner[label] === p.id, `"${label}" used by ${owner[label]} and ${p.id}`);
      owner[label] = p.id;
    }
  }
});

test('every product is priced at every chain, including Carrefour', () => {
  assert.ok(CHAINS.some((c) => c.id === 'carrefour'));
  for (const p of PRODUCTS) {
    for (const c of CHAINS) assert.ok(p.prices[c.id] > 0, `${p.id} @ ${c.id}`);
  }
});

test('mock prices are stable and plausible', () => {
  const milk = PRODUCTS.find((p) => p.id === 'milk');
  assert.equal(milk.prices.shufersal, 7.12);
  assert.equal(milk.prices.carrefour, 6.95);
  for (const p of PRODUCTS) {
    const vals = Object.values(p.prices);
    // cheap produce really does vary ~2x between discount and premium chains
    assert.ok(Math.max(...vals) / Math.min(...vals) <= 2.1, `${p.id} spread too wide`);
  }
});
