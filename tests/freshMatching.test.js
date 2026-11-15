import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFreshGroups, matchScore, FRESH_ITEMS } from '../scripts/fresh_matching.mjs';

const item = (id) => FRESH_ITEMS.find((i) => i.id === id);
const order = ['shufersal', 'ramiLevy', 'yochananof', 'tivTaam'];
// rows: [key, name, manufacturer, unit, weighted, prices[], category]
const row = (key, name, prices, weighted = 1, category = 'produce') => [key, name, '', '', weighted, prices, category];

test('plain names match; varieties, processing and pack sizes do not', () => {
  const tomato = item('tomato');
  assert.equal(matchScore(tomato, 'עגבניה'), 0);
  assert.equal(matchScore(tomato, 'עגבניות'), 0);
  assert.equal(matchScore(tomato, 'עגבניה במשקל'), 0);          // filler
  assert.equal(matchScore(tomato, 'עגבניות שרי תמר'), -1);      // variety
  assert.equal(matchScore(tomato, 'עגבניה אורגנית במשקל'), -1); // organic
  assert.equal(matchScore(tomato, 'עגבניות 500 גרם'), -1);      // pack, not per kg
  assert.equal(matchScore(item('potato'), 'תפו"א לבן ארוז'), 1);
  assert.equal(matchScore(item('pear'), 'אגס אנגו ארה"ב'), -1);  // produce: no extra words
  assert.equal(matchScore(item('pargit'), 'פרג במשקל'), -1);    // poppy seeds ≠ פרגיות
  assert.equal(matchScore(item('chicken-breast'), 'חזה עוף פרימיום'), -1);
  assert.ok(matchScore(item('chicken-breast'), 'חזה עוף טרי ארוז-קור') >= 0);
});

test('groups pick the plain per-kg item in each chain; internal codes stay separate', () => {
  const products = [
    row('shufersal:7290000000022', 'עגבניה', [7.9, null, null, null]),
    row('7290019600077', 'עגבניות מגי ארוז', [18.9, null, null, 19.9]),
    row('ramiLevy:7290000000100', 'עגבניה', [null, 6.9, null, null]),
    row('yochananof:725', 'עגבניה', [null, null, 6.9, null]),
    row('7290000000000x', 'עגבניות 1 ק"ג', [null, null, 5.0, null], 0), // not weighted
    row('tivTaam:4412784', 'עגבניות', [null, null, null, 8.9]),
  ];
  const [g] = buildFreshGroups(products, order).filter((x) => x.id === 'tomato');
  assert.deepEqual(g.members, {
    shufersal: 'shufersal:7290000000022', ramiLevy: 'ramiLevy:7290000000100',
    yochananof: 'yochananof:725', tivTaam: 'tivTaam:4412784',
  });
  assert.deepEqual(g.suspect, []);
});

test('department must match (a pantry item never joins a meat group)', () => {
  const products = [
    row('a', 'פרגיות עוף טרי ארוז', [64.9, null, null, null], 1, 'meat'),
    row('b', 'פרגיות טרי ארוז', [null, 59.9, null, null], 1, 'meat'),
    row('c', 'פרגית', [null, null, 45, null], 1, 'pantry'),
  ];
  const [g] = buildFreshGroups(products, order).filter((x) => x.id === 'pargit');
  assert.deepEqual(Object.keys(g.members), ['shufersal', 'ramiLevy']);
});

test('a price far from the other chains is flagged as suspect, not changed', () => {
  const products = [
    row('s', 'מלפפון', [6.9, null, null, null]),
    row('r', 'מלפפון', [null, 6.9, null, null]),
    row('y', 'מלפפון', [null, null, 5.9, null]),
    row('t', 'מלפפון', [null, null, null, 39.9]),
  ];
  const [g] = buildFreshGroups(products, order).filter((x) => x.id === 'cucumber');
  assert.deepEqual(g.suspect, ['tivTaam']);
  assert.equal(g.members.tivTaam, 't');
});

test('a group needs at least two chains', () => {
  const groups = buildFreshGroups([row('s', 'כרובית', [12.9, null, null, null])], order);
  assert.equal(groups.find((g) => g.id === 'cauliflower'), undefined);
});
