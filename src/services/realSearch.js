// Search over REAL products (from real_prices.json).
//
// 1) Direct: the query's words are matched against the real item name + manufacturer.
// 2) Expansion: the query is also looked up in the dictionary (src/data/catalog) so nicknames,
//    brands and departments work — "גו" finds "יופלה GO …", "כריות" finds the cereal, even when
//    the real item name is written differently. Expansion only ranks real items; it never adds any.

import { normalize } from './hebrew.js';
import { searchProducts as searchDictionary } from './categorizer.js';

const has = (hay, phrase) => ` ${hay} `.includes(` ${phrase} `);
const hasWordStart = (hay, part) => ` ${hay}`.includes(` ${part}`);

function directScore(p, q, tokens) {
  if (p.nameNorm === q) return 100;
  if (p.nameNorm.startsWith(q)) return 95;
  if (hasWordStart(p.norm, q)) return 85;
  let sum = 0;
  for (const t of tokens) {
    if (hasWordStart(p.norm, t)) sum += 70;
    else if (t.length >= 3 && p.norm.includes(t)) sum += 50;
    else return 0; // every word must match
  }
  return sum / tokens.length;
}

/** Ranked real products for a query: [{ product, score, via: 'name'|'dictionary' }]. */
export function searchReal(db, query, limit = 10) {
  if (!db) return [];
  const q = normalize(query);
  if (q.length < 2) return [];
  const strong = rank(db, query, q, 85, limit);
  // Nothing found → let typo-tolerant dictionary hits help ("קורנפלס" → קורנפלקס).
  return strong.length ? strong : rank(db, query, q, 35, limit);
}

function rank(db, query, q, minDictScore, limit) {
  const tokens = q.split(' ').filter(Boolean);

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
    const direct = directScore(p, q, tokens);
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
    const score = Math.max(direct, expanded) + (direct && expanded ? 2 : 0) + (tagged ? 1 : 0) + (p.fresh ? 5 : 0);
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
