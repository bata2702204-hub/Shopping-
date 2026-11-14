import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBasket, MockPriceProvider, createPriceService } from '../src/services/priceService.js';

const chains = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('computeBasket totals, cheapest, savings, split', () => {
  const items = [{ id: '1', qty: 2 }, { id: '2', qty: 1 }];
  const quotes = {
    1: { prices: { a: 10, b: 8, c: 12 }, estimated: false },
    2: { prices: { a: 5, b: 9, c: 6 }, estimated: true },
  };
  const r = computeBasket(items, quotes, chains);
  assert.deepEqual(r.totals.map((t) => [t.chainId, t.total]), [['a', 25], ['b', 25], ['c', 30]]);
  assert.equal(r.cheapest.chainId, 'a');
  assert.equal(r.priciest.chainId, 'c');
  assert.equal(r.savings, 5);
  assert.equal(r.splitTotal, 21); // 2*8 + 5
  assert.equal(r.perItem[1].cheapestChain, 'b');
  assert.equal(r.estimatedCount, 1);
});

test('missing prices rank a chain lower', () => {
  const r = computeBasket([{ id: '1', qty: 1 }], { 1: { prices: { a: null, b: 9, c: 10 } } }, chains);
  assert.equal(r.cheapest.chainId, 'b');
  assert.equal(r.totals.at(-1).chainId, 'a');
});

test('empty list', () => {
  const r = computeBasket([], {}, chains);
  assert.equal(r.savings, 0);
  assert.equal(r.itemCount, 0);
});

test('mock provider: catalog item exact, unknown item estimated', async () => {
  const svc = createPriceService(new MockPriceProvider({ latency: 0 }));
  const q = await svc.getQuotes([
    { id: 'x', name: 'חלב', category: 'dairy', productId: 'milk' },
    { id: 'y', name: 'משהו', category: 'pantry', productId: null },
  ]);
  assert.equal(q.x.estimated, false);
  assert.equal(q.x.prices.shufersal, 7.12);
  assert.equal(q.y.estimated, true);
  assert.ok(q.y.prices.ramiLevy > 0);
});
