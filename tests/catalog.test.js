import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../src/data/dictionary.js';
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



test('dictionary carries no prices or units (real data only)', () => {
  for (const p of PRODUCTS) {
    assert.equal(p.prices, undefined, p.id);
    assert.equal(p.unit, undefined, p.id);
  }
});
