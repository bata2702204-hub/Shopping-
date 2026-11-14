import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize, suggest, searchProducts } from '../src/services/categorizer.js';

const cases = {
  'חלב': 'dairy', 'ביצים': 'dairy', 'ביצה': 'dairy', 'קוטג׳': 'dairy', 'גבינה צהובה': 'dairy', 'שוקו': 'dairy',
  'עגבניות': 'produce', 'עגבניה': 'produce', 'מלפפון': 'produce', 'בננות': 'produce', 'פטרוזיליה': 'produce',
  'תותים': 'produce', 'כרובית': 'produce',
  'חומר כביסה': 'cleaning', 'נייר טואלט': 'cleaning', 'סבון כלים': 'cleaning', 'מטהר אוויר': 'cleaning',
  'סוללות AA': 'cleaning', 'נורה': 'cleaning',
  'שניצל': 'meat', 'חזה עוף': 'meat', 'כנפיים': 'meat', 'סלמון': 'meat',
  'גלידה': 'frozen', 'פיצה קפואה': 'frozen', 'אפונה קפואה': 'frozen', 'חזה עוף קפוא': 'frozen',
  'אורז': 'pantry', 'פסטה': 'pantry', 'פלפל שחור': 'pantry', 'שקדים': 'pantry', 'הטחינה': 'pantry',
  'לחם': 'bakery', 'פיתות': 'bakery',
  // brands / nicknames
  'כריות': 'pantry', 'שוגי': 'pantry', 'קוקומן': 'pantry', 'תלמה': 'pantry',
  // subcategory words
  'חד פעמי': 'cleaning', 'צלחות חד פעמיות לאירוע': 'cleaning', 'סכו"ם': 'cleaning',
  // typo
  'קורנפלס': 'pantry',
  // unknown
  'מתנה': 'other', 'ספר': 'other',
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
  assert.equal(categorize('כריות').product.id, 'krayot');
  assert.equal(categorize('קורנפלס').product.id, 'cornflakes');
  assert.equal(categorize('משהו לא קיים').product, null);
});

test('"חד פעמי" suggests the disposables', () => {
  const ids = suggest('חד פעמי', 10).map((p) => p.id);
  for (const id of ['disposable-cups', 'disposable-plates', 'disposable-cutlery', 'disposable-tablecloth']) {
    assert.ok(ids.includes(id), `missing ${id}: ${ids}`);
  }
  // products with "חד פעמי" in the name rank above subcategory-only hits
  assert.ok(ids.indexOf('disposable-cups') < ids.indexOf('napkins'));
});

test('brands and nicknames surface cereals', () => {
  assert.equal(suggest('כריות')[0].id, 'krayot');
  assert.equal(suggest('שוגי')[0].id, 'shugi');
  assert.equal(suggest('קוקומן')[0].id, 'kokoman');
  const telma = searchProducts('תלמה');
  assert.ok(telma.some((r) => r.product.id === 'cornflakes' && r.via === 'brand'));
});

test('partial matches inside names, aliases and subcategories', () => {
  assert.ok(suggest('פלקס').some((p) => p.id === 'cornflakes'));        // mid-word in name
  assert.ok(suggest('דגני בוקר', 10).length >= 6);                       // subcategory
  assert.ok(suggest('סכום').some((p) => p.id === 'disposable-cutlery')); // alias without gershayim
  assert.ok(suggest('עגבניה').some((p) => p.id === 'tomato'));           // singular/plural
});

test('typos are tolerated but do not crowd out real matches', () => {
  assert.equal(suggest('קורנפלס')[0].id, 'cornflakes');
  assert.ok(searchProducts('מגבונים').every((r) => r.via !== 'fuzzy'));
});

test('short queries', () => {
  assert.deepEqual(suggest('ח'), []);
  const ids = suggest('חל').map((p) => p.id);
  assert.ok(ids.includes('milk') && ids.includes('challah'));
});
