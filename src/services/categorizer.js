// Smart categorization + fuzzy search over the DICTIONARY (src/data/catalog).
// Used to put free text / real product names in a department and to expand searches
// ("כריות" → cereals, "גו" → GO). It never produces prices.
//
// categorize(text) → { category, product }
//   1) catalog match on names/aliases (Hebrew plural tolerant), brands as a weaker signal
//   2) department keyword roots
//   3) subcategory names ("חד פעמי", "דגני בוקר" …)
//   4) fuzzy search (prefix / typo tolerant)
//   5) otherwise "other". The user can always override the category in edit.
//
// searchProducts(query) → ranked [{ product, score, via }] for autocomplete. Matches partial text
// in the product name, aliases, brands, subcategory and department name, plus stems and typos.

import { PRODUCTS } from '../data/dictionary.js';
import { CATEGORY_BY_ID } from '../data/categories.js';
import { normalize, phraseKey, containsPhrase, editDistance } from './hebrew.js';

// ── Exact-ish matching index for categorization ──────────────────────────────
const LABEL_INDEX = PRODUCTS.flatMap((product) => [
  ...[product.name, ...product.aliases].map((label) => ({ product, key: phraseKey(label), strong: true })),
  ...product.brands.map((label) => ({ product, key: phraseKey(label), strong: false })),
]);

// Subcategory → department (most common department for that subcategory).
const SUB_INDEX = (() => {
  const counts = {};
  for (const p of PRODUCTS) {
    const key = phraseKey(p.sub);
    counts[key] ??= {};
    counts[key][p.category] = (counts[key][p.category] || 0) + 1;
  }
  return Object.entries(counts).map(([key, byCat]) => ({
    key,
    category: Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][0],
  }));
})();

// Keyword roots (substring match on normalized text). Order matters: more specific first,
// so "שניצל קפוא" → frozen and "סבון כלים" → cleaning.
const KEYWORDS = [
  ['frozen', ['קפוא', 'גליד', 'ארטיק', 'שלגון', 'קרטיב']],
  ['cleaning', ['ניקוי', 'כביס', 'סבון', 'כלים', 'מדיח', 'אקונומיק', 'נייר', 'שקיות', 'אשפה', 'מטהר',
    'מבריק', 'ספריי', 'מגבונ', 'שמפו', 'מרכך', 'דאודורנט', 'גילוח', 'טמפונ', 'תחבוש', 'חיתול', 'מברשת',
    'חד פעמי', 'חד-פעמי', 'סוללו', 'נורה', 'נורת', 'נרות', 'כפפות', 'צלחת', 'צלחות', 'כוסות', 'קעריות',
    'תבנית', 'תבניות', 'גביעי', 'רדיד', 'אלומיני', 'מפות', 'מפת', 'צמרונ', 'מברשות', 'פינצט', 'קיסמ',
    'שיפוד', 'לגבר', 'תחתון סופג', 'אביזרים לבית', 'להסרת שיער', 'סכו', 'מגבת', 'מגבות', 'שמפו', 'קרם']],
  ['meat', ['בשר', 'עוף', 'עופות', 'דג ', 'דגים', 'קבב', 'המבורגר', 'כבד', 'צלי', 'אסאדו', 'כנפיים',
    'פרגית', 'סטייק', 'נקניק', 'קציצ', 'טונה טרי', 'בקר', 'כבש']],
  ['dairy', ['חלב', 'גבינ', 'יוגורט', 'שמנת', 'מעדן', 'ביצ', 'לבן', 'אשל', 'גיל ', 'קפיר', 'מוצרל', 'פרמז']],
  ['bakery', ['לחם', 'לחמני', 'פית', 'מאפ', 'בגט', 'חלה', 'חלות', 'עוגה', 'עוגת', 'קרואסון', 'טורטיי', 'לאפה']],
  ['produce', ['ירק', 'פרי', 'פירות', 'סלט', 'עלי ', 'נענע', 'שמיר', 'בזיליק', 'תות', 'אפרסק', 'שזיפ',
    'אגס', 'מנגו', 'קלמנטינ', 'אננס', 'רימונ', 'תאנ', 'כרוב', 'כרובית', 'ברוקולי', 'סלק', 'צנון', 'קולורבי',
    'דלעת', 'תירס טרי', 'בצל ירוק', 'ג\'ינג\'ר', 'שרי']],
  ['pantry', ['שימור', 'קמח', 'רוטב', 'תבלין', 'פפריקה', 'כמון', 'פלפל שחור', 'פסטה', 'אורז', 'קפה', 'תה ',
    'חטיף', 'עוגיות', 'דגני', 'שמן', 'שוקולד', 'ממרח', 'סוכר', 'קטניות', 'שעועית', 'חומץ', 'שקדים',
    'אגוז', 'בוטנ', 'גרעינ', 'צימוק', 'תמר', 'שתי', 'מיץ', 'בירה', 'יין', 'סודה', 'מים', 'פודינג',
    'אבקת אפיה', 'שמרים', 'וניל', 'קוסקוס', 'בורגול', 'קינואה', 'מרק', 'אבקת מרק', 'פירורי לחם']],
];

/** Word index where phrase `needle` starts inside `hay` (both phrase keys), or null. */
function wordIndex(hay, needle) {
  const i = ` ${hay} `.indexOf(` ${needle} `);
  return i < 0 ? null : hay.slice(0, i).split(' ').filter(Boolean).length;
}

/** Find the best catalog product for free text, or null. Brands alone are a weak signal. */
export function matchProduct(text) {
  const raw = phraseKey(text);
  const bare = phraseKey(text, { dropPrefix: true });
  if (!raw) return null;

  let best = null;
  let bestScore = 0;
  for (const { product, key, strong } of LABEL_INDEX) {
    if (!key) continue;
    let score = 0;
    if (key === raw || key === bare) score = strong ? 1000 : 500;
    else {
      // Partial match: longer labels win, and labels near the start win more — in product names
      // the first words say what it is ("יופלה GO אפרסק" is a yogurt, not a peach).
      const pos = wordIndex(raw, key) ?? wordIndex(bare, key);
      if (pos != null) score = (strong ? 100 : 20) + key.length + (pos === 0 ? 15 : -2 * pos);
    }
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

/** Category from a subcategory name inside the text ("צלחות חד פעמיות לאירוע" → cleaning), or null. */
export function categoryFromSubcategory(text) {
  const raw = phraseKey(text, { dropPrefix: true });
  let best = null;
  for (const { key, category } of SUB_INDEX) {
    if (containsPhrase(raw, key) && (!best || key.length > best.key.length)) best = { key, category };
  }
  return best?.category || null;
}

// ── Fuzzy search ──────────────────────────────────────────────────────────────
const WEIGHT = { name: 1, alias: 0.92, brand: 0.8, sub: 0.7, category: 0.5 };

function buildEntry(product, order) {
  const fields = [
    { kind: 'name', text: product.name },
    ...product.aliases.map((text) => ({ kind: 'alias', text })),
    ...product.brands.map((text) => ({ kind: 'brand', text })),
    { kind: 'sub', text: product.sub },
    { kind: 'category', text: CATEGORY_BY_ID[product.category]?.name || '' },
  ].map((f) => ({ ...f, norm: normalize(f.text), stem: phraseKey(f.text), w: WEIGHT[f.kind] }));
  // Words for typo matching, keeping the strongest field weight each word appears in.
  const words = new Map();
  fields.filter((f) => f.kind !== 'category' && f.kind !== 'sub').forEach((f) => f.norm.split(' ').forEach((w) => {
    if (w.length >= 3 && (words.get(w) || 0) < f.w) words.set(w, f.w);
  }));
  return { product, order, fields, words: [...words] };
}

const SEARCH_INDEX = PRODUCTS.map(buildEntry);


function textScore(field, q) {
  if (field === q) return 100;
  if (field.startsWith(q)) return 90;
  if (field.includes(` ${q}`)) return 75;
  if (q.length >= 4 && field.includes(q)) return 55; // mid-word only for 4+ letters (less noise)
  return 0;
}

/** Best score of one query (phrase or token) against an entry's fields. Returns { score, via }. */
function scoreTerm(entry, q, qStem) {
  let score = 0;
  let via = null;
  for (const f of entry.fields) {
    let s = textScore(f.norm, q);
    if (!s && qStem && qStem.length >= 2) {
      if (f.stem === qStem) s = 85;
      else if (qStem.length >= 4 && (f.stem.startsWith(qStem) || f.stem.includes(` ${qStem}`))) s = 65;
    }
    // Exact brand ("גו", "פרו", "תלמה") ranks right under an exact product name.
    if (f.kind === 'brand' && f.norm === q) s = 97;
    else s *= f.w;
    if (s > score) { score = s; via = f.kind; }
  }
  return { score, via };
}

/**
 * Typo tolerance: 1 edit for 4–6 letters, 2 for 7+; also tolerant prefixes while still typing.
 * Fewer edits and stronger fields (name > alias > brand) score higher.
 */
function fuzzyTerm(entry, q) {
  if (q.length < 4) return 0;
  const max = q.length >= 7 ? 2 : 1;
  let best = 0;
  for (const [w, weight] of entry.words) {
    const d = editDistance(w, q, max);
    if (d <= max) best = Math.max(best, (d <= 1 ? 48 : 40) * weight);
    else if (w.length > q.length && editDistance(w.slice(0, q.length), q, 1) <= 1) best = Math.max(best, 35 * weight);
  }
  return best;
}

/** Ranked catalog matches for free text. */
export function searchProducts(query, limit = 8) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const qStem = phraseKey(query, { dropPrefix: true });
  const tokens = q.split(' ').filter((t) => t.length >= 2);

  const results = [];
  for (const entry of SEARCH_INDEX) {
    let { score, via } = scoreTerm(entry, q, qStem);

    if (!score && tokens.length > 1) {
      // Every word must match somewhere (e.g. "גבינה תנובה", "צלחות פלסטיק").
      let sum = 0;
      let all = true;
      for (const t of tokens) {
        const r = scoreTerm(entry, t, phraseKey(t, { dropPrefix: true }));
        const s = r.score || fuzzyTerm(entry, t);
        if (!s) { all = false; break; }
        sum += s;
        via ||= r.via || 'fuzzy';
      }
      if (all) score = (sum / tokens.length) * 0.85;
    }

    if (!score) {
      score = fuzzyTerm(entry, q);
      if (score) via = 'fuzzy';
    }
    if (score) results.push({ product: entry.product, score, via, order: entry.order });
  }

  // Typo matches only fill in when there's nothing solid.
  const solid = results.some((r) => r.via !== 'fuzzy' && r.score >= 50);
  const kept = solid ? results.filter((r) => r.via !== 'fuzzy') : results;
  kept.sort((a, b) => b.score - a.score || a.product.name.length - b.product.name.length || a.order - b.order);
  return kept.slice(0, limit).map(({ product, score, via }) => ({ product, score: Math.round(score), via }));
}

/** Autocomplete suggestions (products only). */
export function suggest(query, limit = 8) {
  return searchProducts(query, limit).map((r) => r.product);
}

/** Main entry: categorize free text. */
export function categorize(text) {
  const product = matchProduct(text);
  const keywordCat = categoryFromKeywords(text);
  // A keyword like "קפוא" overrides a fresh-product match ("חזה עוף קפוא" → frozen).
  if (product && product.category !== 'frozen' && keywordCat === 'frozen') return { category: 'frozen', product };
  if (product) return { category: product.category, product };

  if (keywordCat !== 'other') return { category: keywordCat, product: null };

  const subCat = categoryFromSubcategory(text);
  if (subCat) return { category: subCat, product: null };

  // Fuzzy fallback: prefixes ("קורנפ") and typos ("קורנפלס") of known products.
  const [top] = searchProducts(text, 1);
  const q = normalize(text);
  // Short inputs need an exact name/alias hit ("ספר" must not become "ספריי").
  const strongEnough = q.length >= 4 ? top?.score >= 60 : top?.score >= 92;
  if (top && (strongEnough || (top.via === 'fuzzy' && q.length >= 5))) {
    return { category: top.product.category, product: top.score >= 80 || top.via === 'fuzzy' ? top.product : null };
  }
  return { category: 'other', product: null };
}
