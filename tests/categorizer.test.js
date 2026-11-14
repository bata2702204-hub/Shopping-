import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize, suggest } from '../src/services/categorizer.js';

const cases = {
  'חלב': 'dairy', 'ביצים': 'dairy', 'ביצה': 'dairy', 'קוטג׳': 'dairy', 'גבינה צהובה': 'dairy',
  'עגבניות': 'produce', 'עגבניה': 'produce', 'מלפפון': 'produce', 'בננות': 'produce', 'פטרוזיליה': 'produce',
  'תותים': 'produce', 'כרובית': 'produce',
  'חומר כביסה': 'cleaning', 'נייר טואלט': 'cleaning', 'סבון כלים': 'cleaning', 'מטהר אוויר': 'cleaning',
  'שניצל': 'meat', 'חזה עוף': 'meat', 'כנפיים': 'meat', 'סלמון': 'meat',
  'גלידה': 'frozen', 'פיצה קפואה': 'frozen', 'אפונה קפואה': 'frozen', 'חזה עוף קפוא': 'frozen',
  'אורז': 'pantry', 'פסטה': 'pantry', 'פלפל שחור': 'pantry', 'שקדים': 'pantry', 'הטחינה': 'pantry',
  'לחם': 'bakery', 'פיתות': 'bakery',
  'סוללות AA': 'other', 'נורה': 'other',
};

for (const [input, expected] of Object.entries(cases)) {
  test(`categorize "${input}" → ${expected}`, () => {
    assert.equal(categorize(input).category, expected);
  });
}

test('product match picks catalog item', () => {
  assert.equal(categorize('חלב').product.id, 'milk');
  assert.equal(categorize('עגבניות שרי').product.id, 'tomato');
  assert.equal(categorize('פלפל שחור').product.id, 'black-pepper');
  assert.equal(categorize('סוללות').product, null);
});

test('suggest returns prefix matches first', () => {
  const ids = suggest('חל').map((p) => p.id);
  assert.ok(ids.includes('milk') && ids.includes('challah'));
  assert.deepEqual(suggest('ח'), []);
});
