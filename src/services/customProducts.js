// User-created products: the fallback for anything the catalog doesn't know.
//
// When an added item matches no catalog product, a custom product is created from the typed name,
// placed in the department detected by keywords, and given an estimated price per chain (the
// median shelf price of that department at that chain). Custom products are saved on the device,
// show up in search like catalog products, and take part in the price comparison as "estimated".

import { PRODUCTS, PRODUCT_BY_ID } from '../data/products.mock.js';
import { CHAINS } from '../data/chains.js';
import { normalize } from './hebrew.js';

const STORAGE_KEY = 'smart-shopping:custom-products:v1';
const MAX_CUSTOM = 300;
export const CUSTOM_SUB = 'מוצר שהוספתי';

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (n) => Math.round(n * 10) / 10;

// Median price per department per chain (robust against outliers like steak or diapers).
const CATEGORY_MEDIAN = (() => {
  const out = {};
  const cats = [...new Set(PRODUCTS.map((p) => p.category))];
  for (const cat of cats) {
    const items = PRODUCTS.filter((p) => p.category === cat);
    out[cat] = Object.fromEntries(CHAINS.map((c) => [c.id, round1(median(items.map((p) => p.prices[c.id])))]));
  }
  out.other = Object.fromEntries(CHAINS.map((c) => [c.id, round1(median(PRODUCTS.map((p) => p.prices[c.id])))]));
  return out;
})();

/** Estimated price per chain for an unknown product in a department. */
export function estimatePrices(category) {
  return { ...(CATEGORY_MEDIAN[category] || CATEGORY_MEDIAN.other) };
}

// ── Storage (localStorage when available, memory otherwise) ──
let cache = null;
let version = 0;

function load() {
  if (cache) return cache;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw).filter((p) => p && p.id && p.name) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save() {
  version += 1;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* private mode etc. */ }
}

/** Changes whenever the custom list changes (lets search rebuild its index lazily). */
export const customVersion = () => version;

export function getCustomProducts() {
  return load();
}

export function findCustomByName(name) {
  const n = normalize(name);
  return n ? load().find((p) => normalize(p.name) === n) || null : null;
}

/** Catalog product or custom product by id. */
export function lookupProduct(id) {
  if (!id) return null;
  return PRODUCT_BY_ID[id] || load().find((p) => p.id === id) || null;
}

/**
 * Get or create the custom product for a name. If it exists with another department
 * (the user re-categorized it), it moves there and is re-priced.
 */
export function upsertCustomProduct(name, category = 'other') {
  const list = load();
  const existing = findCustomByName(name);
  if (existing) {
    if (existing.category !== category) {
      existing.category = category;
      existing.prices = estimatePrices(category);
      save();
    }
    return existing;
  }
  const product = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    category,
    sub: CUSTOM_SUB,
    unit: 'יח\'',
    aliases: [],
    brands: [],
    prices: estimatePrices(category),
    custom: true,
    createdAt: Date.now(),
  };
  list.push(product);
  if (list.length > MAX_CUSTOM) list.splice(0, list.length - MAX_CUSTOM);
  save();
  return product;
}

/** For tests. */
export function _resetCustomProducts() {
  cache = [];
  save();
}
