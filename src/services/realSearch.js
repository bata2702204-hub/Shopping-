// Search over REAL products (from real_prices.json).
//
// 1) Direct: the query's words are matched against the real item name + manufacturer.
// 2) Expansion: the query is also looked up in the dictionary (src/data/catalog) so nicknames,
//    brands and departments work — "גו" finds "יופלה GO …", "כריות" finds the cereal, even when
//    the real item name is written differently. Expansion only ranks real items; it never adds any.

import { normalize, stemWord } from './hebrew.js';
import { searchProducts as searchDictionary } from './categorizer.js';
import { getCategory } from '../data/categories.js';

// Words people type that never appear in product names ("פיצה של מעדנות").
const STOP = new Set(['של', 'עם', 'את', 'גם', 'או', 'בשביל', 'עבור', 'מסוג', 'מותג', 'חברת', 'סוג', 'מבית']);

// Word stems of name + manufacturer + department (e.g. "קפואים"), computed once per product.
function stemsOf(p) {
  if (!p._stems) {
    const words = `${p.norm} ${normalize(getCategory(p.category).name)}`.split(' ').filter(Boolean);
    p._stems = words.map(stemWord);
  }
  return p._stems;
}

/** How well one query word matches a product (0 = not at all). */
function tokenScore(p, t) {
  if (hasWordStart(p.norm, t)) return 70;
  if (t.length >= 3 && p.norm.includes(t)) return 50;
  const st = stemWord(t); // plurals / feminine: "פיצות" → "פיצ" matches "פיצה"; "קפואה" matches department "קפואים"
  if (st.length >= 2 && stemsOf(p).some((s) => s.startsWith(st))) return 45;
  return 0;
}

const has = (hay, phrase) => ` ${hay} `.includes(` ${phrase} `);
const hasWordStart = (hay, part) => ` ${hay}`.includes(` ${part}`);

function directScore(p, q, tokens, allowMissing) {
  if (p.nameNorm === q) return 100;
  if (p.nameNorm.startsWith(q)) return 95;
  if (hasWordStart(p.norm, q)) return 85;
  let sum = 0;
  let missing = 0;
  for (const t of tokens) {
    const s = tokenScore(p, t);
    if (!s && ++missing > allowMissing) return 0; // every word must match (or all but one, as a fallback)
    sum += s;
  }
  return (sum / tokens.length) * (missing ? 0.7 : 1);
}

/** Ranked real products for a query: [{ product, score, via: 'name'|'dictionary' }]. */
export function searchReal(db, query, limit = 10) {
  if (!db) return [];
  const q = normalize(query);
  if (q.length < 2) return [];
  const strong = rank(db, query, q, 85, limit, 0);
  if (strong.length) return strong;
  // Nothing found → typo-tolerant dictionary hits ("קורנפלס" → קורנפלקס), and for 3+ words one
  // word may be missing ("פיצה ביתית מעדנות").
  return rank(db, query, q, 35, limit, 1);
}

function rank(db, query, q, minDictScore, limit, allowMissing) {
  const all = q.split(' ').filter(Boolean);
  const kept = all.filter((t) => !STOP.has(t));
  const tokens = kept.length ? kept : all;
  const missingOk = tokens.length >= 3 ? allowMissing : 0;

  // In multi-word queries, a word that names a product TYPE ("פיצה"/"פיצות" → frozen pizza) makes items
  // of that type rank first ("פיצה מעדנות": the pizzas before Maadanot's pizza-flavoured bourekas).
  const typeIds = new Set(tokens.length < 2 ? [] : tokens.flatMap((t) => searchDictionary(t, 1)
    .filter((r) => r.score >= 75 && (r.via === 'name' || r.via === 'alias')).map((r) => r.product.id)));

  // Dictionary expansion: dictionary hits contribute their names/aliases/brands as phrases.
  const dict = searchDictionary(query, 4).filter((r) => r.score >= minDictScore);
  // An exact dictionary hit (brand / nickname / name, e.g. "גו", "כריות") outranks loose prefix
  // matches like "גויאבות". Brand phrases are used only when the hit came through the brand,
  // so "חלב" doesn't pull in every Tnuva product.
  const expansions = dict.map((r) => ({
    id: r.product.id,
    score: r.score >= 92 ? 98 : r.score * 0.9,
    phrases: [...new Set((r.via === 'brand' ? [r.product.name, ...r.product.brands]
      : [r.product.name, ...r.product.aliases]).map(normalize))].filter((x) => x.length >= 2),
  }));

  const results = [];
  for (const p of db.products) {
    const direct = directScore(p, q, tokens, missingOk);
    let expanded = 0;
    let tagged = false;
    for (const e of expansions) {
      const phrase = e.phrases.some((ph) => has(p.norm, ph));
      const sameEntry = p.dictId === e.id;
      if (!phrase && !sameEntry) continue;
      // A whole-phrase hit counts fully; a department tag alone counts a bit less.
      const s = phrase ? e.score : e.score - 8;
      if (s > expanded) expanded = s;
      tagged ||= sameEntry && phrase;
    }
    if (!direct && !expanded) continue;
    // Matching both ways (and being tagged with that entry) beats matching one way.
    // Name-matched fresh groups compare across chains, so they lead their own search ("עגבניה").
    const score = Math.max(direct, expanded) + (direct && expanded ? 2 : 0) + (tagged ? 1 : 0) + (p.fresh ? 5 : 0)
      + (typeIds.has(p.dictId) ? 4 : 0);
    results.push({ product: p, score, via: expanded > direct ? 'dictionary' : 'name' });
  }

  // Better match first; then items sold in more chains (comparable), then shorter names.
  results.sort((a, b) => b.score - a.score
    || b.product.chainCount - a.product.chainCount
    || a.product.name.length - b.product.name.length);
  return results.slice(0, limit);
}

/** Exact real product for typed text (same normalized name), or null. */
export function exactReal(db, text) {
  if (!db) return null;
  const q = normalize(text);
  return db.products.find((p) => p.nameNorm === q) || null;
}
