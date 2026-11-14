import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertCustomProduct, findCustomByName, lookupProduct, estimatePrices, _resetCustomProducts,
} from '../src/services/customProducts.js';
import { categorize, searchProducts } from '../src/services/categorizer.js';
import { MockPriceProvider, createPriceService } from '../src/services/priceService.js';
import { CHAINS } from '../src/data/chains.js';

beforeEach(() => _resetCustomProducts());

test('estimated department prices exist for every chain and are sensible', () => {
  for (const cat of ['produce', 'bakery', 'meat', 'dairy', 'pantry', 'cleaning', 'frozen', 'other']) {
    const p = estimatePrices(cat);
    for (const c of CHAINS) assert.ok(p[c.id] > 0 && p[c.id] < 100, `${cat}@${c.id}=${p[c.id]}`);
  }
  // discount chain cheaper than premium chain for the median too
  assert.ok(estimatePrices('pantry').ramiLevy < estimatePrices('pantry').tivTaam);
});

test('unknown name → custom product with keyword department and estimated prices', () => {
  const name = 'רוטב מיוחד של סבתא';
  assert.equal(categorize(name).product, null);
  const { category } = categorize(name);
  assert.equal(category, 'pantry'); // keyword "רוטב"
  const p = upsertCustomProduct(name, category);
  assert.equal(p.custom, true);
  assert.deepEqual(p.prices, estimatePrices('pantry'));
  assert.equal(lookupProduct(p.id), p);
});

test('custom product is reused, searchable and remembered by categorize', () => {
  const a = upsertCustomProduct('גבינת קשקבל מיוחדת', 'dairy');
  const b = upsertCustomProduct('גבינת קשקבל מיוחדת', 'dairy');
  assert.equal(a.id, b.id);
  assert.equal(findCustomByName('גבינת קשקבל מיוחדת').id, a.id);
  const hits = searchProducts('קשקבל');
  assert.equal(hits[0].product.id, a.id);
  assert.equal(hits[0].via, 'custom');
  assert.equal(categorize('גבינת קשקבל מיוחדת').product.id, a.id);
});

test('re-categorizing a custom product re-prices it', () => {
  const p = upsertCustomProduct('דבר מוזר', 'other');
  upsertCustomProduct('דבר מוזר', 'meat');
  assert.equal(p.category, 'meat');
  assert.deepEqual(p.prices, estimatePrices('meat'));
});

test('custom products are quoted as estimated', async () => {
  const p = upsertCustomProduct('קפה מיוחד מאתיופיה בשקית', 'pantry');
  const svc = createPriceService(new MockPriceProvider({ latency: 0 }));
  const q = await svc.getQuotes([{ id: 'i1', name: p.name, category: 'pantry', productId: p.id }]);
  assert.equal(q.i1.estimated, true);
  assert.equal(q.i1.prices.carrefour, p.prices.carrefour);
});
