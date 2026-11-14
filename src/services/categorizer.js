// Smart categorization: free text → { category, product }.
// 1) Match against the product catalog (names + aliases, Hebrew-plural tolerant).
// 2) Fall back to per-department keyword roots.
// 3) Otherwise "other". The user can always override the category in edit.

import { PRODUCTS } from '../data/products.mock.js';
import { normalize, phraseKey, containsPhrase } from './hebrew.js';

// Precomputed catalog index: every name/alias as a phrase key.
const INDEX = PRODUCTS.flatMap((product) =>
  [product.name, ...product.aliases].map((label) => ({ product, key: phraseKey(label) })),
);

// Keyword roots (substring match on normalized text). Order matters: more specific first,
// so "שניצל קפוא" → frozen and "סבון כלים" → cleaning.
const KEYWORDS = [
  ['frozen', ['קפוא', 'גליד', 'ארטיק', 'שלגון']],
  ['cleaning', ['ניקוי', 'כביס', 'סבון', 'כלים', 'מדיח', 'אקונומיק', 'נייר', 'שקיות', 'אשפה', 'מטהר',
    'מבריק', 'ספריי', 'מגבונ', 'שמפו', 'מרכך', 'דאודורנט', 'גילוח', 'טמפונ', 'תחבוש', 'חיתול', 'מברשת']],
  ['meat', ['בשר', 'עוף', 'עופות', 'דג ', 'דגים', 'קבב', 'המבורגר', 'כבד', 'צלי', 'אסאדו', 'כנפיים',
    'פרגית', 'סטייק', 'נקניק', 'קציצ', 'טונה טרי', 'בקר', 'כבש']],
  ['dairy', ['חלב', 'גבינ', 'יוגורט', 'שמנת', 'מעדן', 'ביצ', 'לבן', 'אשל', 'גיל ', 'קפיר', 'מוצרל', 'פרמז']],
  ['bakery', ['לחם', 'פית', 'מאפ', 'בגט', 'חלה', 'חלות', 'עוגה', 'עוגת', 'קרואסון', 'טורטיי', 'לאפה']],
  ['produce', ['ירק', 'פרי', 'פירות', 'סלט', 'עלי ', 'נענע', 'שמיר', 'בזיליק', 'תות', 'אפרסק', 'שזיפ',
    'אגס', 'מנגו', 'קלמנטינ', 'אננס', 'רימונ', 'תאנ', 'כרוב', 'כרובית', 'ברוקולי', 'סלק', 'צנון', 'קולורבי',
    'דלעת', 'תירס טרי', 'בצל ירוק', 'ג\'ינג\'ר', 'שרי']],
  ['pantry', ['שימור', 'קמח', 'רוטב', 'תבלין', 'פפריקה', 'כמון', 'פלפל שחור', 'פסטה', 'אורז', 'קפה', 'תה ',
    'חטיף', 'עוגיות', 'דגני', 'שמן', 'שוקולד', 'ממרח', 'סוכר', 'קטניות', 'שעועית', 'חומץ', 'שקדים',
    'אגוז', 'בוטנ', 'גרעינ', 'צימוק', 'תמר', 'שתי', 'מיץ', 'בירה', 'יין', 'סודה', 'מים', 'פודינג',
    'אבקת אפיה', 'שמרים', 'וניל', 'קוסקוס', 'בורגול', 'קינואה', 'מרק', 'אבקת מרק', 'פירורי לחם']],
];

/** Find the best catalog product for free text, or null. */
export function matchProduct(text) {
  const raw = phraseKey(text);
  const bare = phraseKey(text, { dropPrefix: true });
  if (!raw) return null;

  let best = null;
  let bestScore = 0;
  for (const { product, key } of INDEX) {
    let score = 0;
    if (key === raw || key === bare) score = 1000;
    else if (containsPhrase(raw, key) || containsPhrase(bare, key)) score = 100 + key.length;
    if (score > bestScore) { best = product; bestScore = score; }
  }
  return best;
}

/** Category from keyword roots only, or 'other'. */
export function categoryFromKeywords(text) {
  const t = ` ${normalize(text)} `;
  for (const [category, roots] of KEYWORDS) {
    if (roots.some((r) => t.includes(r))) return category;
  }
  return 'other';
}

/** Main entry: categorize free text. */
export function categorize(text) {
  const product = matchProduct(text);
  // A keyword like "קפוא" overrides a fresh-product match ("חזה עוף קפוא" → frozen).
  if (product && product.category !== 'frozen' && categoryFromKeywords(text) === 'frozen') {
    return { category: 'frozen', product };
  }
  if (product) return { category: product.category, product };
  return { category: categoryFromKeywords(text), product: null };
}

/** Autocomplete suggestions: catalog products whose name/alias starts with (or contains) the query. */
export function suggest(query, limit = 6) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const starts = [];
  const contains = [];
  for (const product of PRODUCTS) {
    const labels = [product.name, ...product.aliases].map(normalize);
    if (labels.some((l) => l.startsWith(q))) starts.push(product);
    else if (labels.some((l) => l.includes(q))) contains.push(product);
  }
  return [...starts, ...contains].slice(0, limit);
}
