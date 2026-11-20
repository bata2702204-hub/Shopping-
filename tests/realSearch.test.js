import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRealPrices } from '../src/services/priceService.js';
import { searchReal, exactReal } from '../src/services/realSearch.js';

const db = parseRealPrices({
  chainOrder: ['shufersal'],
  chains: [{ id: 'shufersal', status: 'ok' }],
  fields: ['barcode', 'name', 'manufacturer', 'unit', 'weighted', 'prices', 'category', 'dictId'],
  products: [
    ['1', 'יופלה GO תות 200 גרם', '', '', 0, [6.8], 'dairy', 'yogurt'],
    ['2', 'גויאבות', '', '', 0, [22.9], 'produce', null],
    ['3', 'כריות נוגט 686 גרם תלמה', '', '', 0, [28.9], 'pantry', 'krayot'],
    ['4', 'סוכריות חמאה', '', '', 0, [9.9], 'pantry', 'candies'],
    ['5', 'קורנפלקס 750 גרם', '', '', 0, [17.9], 'pantry', 'cornflakes'],
    ['6', 'חלב 3% בקרטון 1 ל', 'תנובה', '', 0, [7.35], 'dairy', 'milk'],
    ['7', 'מאמאמיה פיצה עם זיתים', 'מעדנות', '', 0, [27.9], 'frozen', 'frozen-pizza'],
    ['8', 'פיצה איטלקית דקה 320גרם', '', '', 0, [16.9], 'frozen', 'frozen-pizza'],
  ],
});
const ids = (q) => searchReal(db, q).map((r) => r.product.barcode);

test('brand nickname finds the real product line first ("גו" → GO, not guava)', () => {
  assert.equal(ids('גו')[0], '1');
});
test('dictionary nickname finds real cereal ("כריות")', () => {
  assert.equal(ids('כריות')[0], '3');
  assert.ok(!ids('כריות').includes('4') || ids('כריות').indexOf('4') > 0);
});
test('typo falls back to dictionary ("קורנפלס")', () => {
  assert.ok(ids('קורנפלס').includes('5'));
});
test('direct words and exact names', () => {
  assert.equal(ids('חלב')[0], '6');
  assert.equal(exactReal(db, 'קורנפלקס 750 גרם').barcode, '5');
  assert.equal(exactReal(db, 'קורנפלקס'), null);
  assert.deepEqual(ids('x'), []);
});

test('brand/manufacturer + product word ("פיצה מעדנות")', () => {
  assert.equal(ids('פיצה מעדנות')[0], '7');
  assert.ok(ids('מעדנות').includes('7'));
});

test('natural phrasings: filler words, plurals, descriptive words', () => {
  for (const q of ['פיצה של מעדנות', 'פיצות מעדנות', 'פיצה קפואה מעדנות', 'מעדנות פיצה']) {
    assert.equal(ids(q)[0], '7', q);
  }
});
