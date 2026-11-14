// Helpers for writing catalog rows compactly and generating realistic per-chain mock prices.
import { CHAINS } from '../chains.js';

// Explicit 5-price tuples (written before Carrefour was added) use this order.
const LEGACY_ORDER = ['shufersal', 'ramiLevy', 'victory', 'yochananof', 'tivTaam'];

/** Deterministic 0..1 from a string (FNV-1a), so mock prices are stable between builds. */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Shelf-style rounding: ₪4.3 / ₪7.9 under ₪10, ₪12.90 / ₪49.90 above. */
function shelf(v) {
  if (v < 10) return Math.max(0.5, Math.round(v * 10) / 10);
  return Math.round(v) - 0.1;
}

/** Mock price for one chain: the chain's price level ± up to 7%, varying per product. */
function generate(id, base, chain) {
  if (chain.id === 'shufersal') return base;
  const jitter = 1 + (hash01(`${id}:${chain.id}`) - 0.5) * 0.14;
  return shelf(base * chain.priceIndex * jitter);
}

const split = (s) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);

/**
 * Build a department's products from rows:
 *   [id, name, sub, unit, price, aliases, brands]
 * price  : number (Shufersal shelf price; other chains generated) or explicit tuple
 *          [shufersal, ramiLevy, victory, yochananof, tivTaam(, carrefour)]
 * aliases: "a|b|c" synonyms / nicknames (strong match)
 * brands : "x|y" common brands (weaker match)
 */
export function department(category, rows) {
  return rows.map(([id, name, sub, unit, price, aliases, brands]) => {
    const explicit = Array.isArray(price) ? Object.fromEntries(LEGACY_ORDER.map((c, i) => [c, price[i]])) : {};
    if (Array.isArray(price) && price[5] != null) explicit.carrefour = price[5];
    const base = Array.isArray(price) ? price[0] : price;
    const prices = Object.fromEntries(CHAINS.map((c) => [c.id, explicit[c.id] ?? generate(id, base, c)]));
    return { id, name, category, sub, unit, aliases: split(aliases), brands: split(brands), prices };
  });
}
