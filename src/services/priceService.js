// ─────────────────────────────────────────────────────────────────────────────
// Price service layer.
//
// The UI only talks to `priceService` (bottom of file). Swapping the data source means
// writing another provider with the same three methods and passing it to createPriceService:
//
//   getChains()          → Promise<Chain[]>                       [{ id, name, color }]
//   getQuote(item)       → Promise<Quote>                         per list item
//       item  = { id, name, category, productId|null }
//       Quote = { prices: { [chainId]: number|null }, estimated: boolean, productName?: string }
//   getQuotes(items)     → Promise<{ [itemId]: Quote }>            batch (default: calls getQuote)
//
// Israel's Food Act (חוק המזון – שקיפות מחירים) obliges chains to publish PriceFull/Promo XML
// files daily. A real provider would call a small backend that downloads and parses those files
// (they are gzipped XML, not CORS-friendly, so they can't be fetched straight from the browser)
// and exposes e.g. GET /api/prices?q=<name>&barcode=<code>. See TransparencyApiProvider below.
// ─────────────────────────────────────────────────────────────────────────────

import { CHAINS } from '../data/chains.js';
import { PRODUCTS, PRODUCT_BY_ID } from '../data/products.mock.js';

const round2 = (n) => Math.round(n * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Average price per chain within each category: used to estimate items that aren't in the catalog.
const CATEGORY_AVG = (() => {
  const acc = {};
  for (const p of PRODUCTS) {
    acc[p.category] ??= { n: 0, sums: {} };
    acc[p.category].n += 1;
    for (const [chain, price] of Object.entries(p.prices)) {
      acc[p.category].sums[chain] = (acc[p.category].sums[chain] || 0) + price;
    }
  }
  const out = {};
  for (const [cat, { n, sums }] of Object.entries(acc)) {
    out[cat] = Object.fromEntries(Object.entries(sums).map(([c, s]) => [c, round2(s / n)]));
  }
  // "other" → average of all categories
  const all = Object.values(out);
  out.other = Object.fromEntries(CHAINS.map((c) => [c.id, round2(all.reduce((s, a) => s + a[c.id], 0) / all.length)]));
  return out;
})();

/** Default provider: in-memory mock catalog with a little simulated latency. */
export class MockPriceProvider {
  constructor({ latency = 120 } = {}) { this.latency = latency; }

  async getChains() {
    return CHAINS;
  }

  async getQuote(item) {
    const product = item.productId ? PRODUCT_BY_ID[item.productId] : null;
    if (product) return { prices: { ...product.prices }, estimated: false, productName: product.name };
    return { prices: { ...(CATEGORY_AVG[item.category] || CATEGORY_AVG.other) }, estimated: true };
  }

  async getQuotes(items) {
    if (this.latency) await sleep(this.latency);
    const entries = await Promise.all(items.map(async (it) => [it.id, await this.getQuote(it)]));
    return Object.fromEntries(entries);
  }
}

/**
 * Example of a real provider (not used by default). Point `baseUrl` at a backend that serves
 * parsed Price-Transparency data. Response shape expected:
 *   POST {baseUrl}/quotes  body: { items: [{ id, name, barcode? }] }
 *   → { [itemId]: { prices: { shufersal: 7.12, ramiLevy: 6.9, ... }, estimated: false } }
 */
export class TransparencyApiProvider {
  constructor({ baseUrl }) { this.baseUrl = baseUrl.replace(/\/$/, ''); }

  async getChains() {
    const res = await fetch(`${this.baseUrl}/chains`);
    if (!res.ok) throw new Error(`chains: HTTP ${res.status}`);
    return res.json();
  }

  async getQuotes(items) {
    const res = await fetch(`${this.baseUrl}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(({ id, name, productId }) => ({ id, name, productId })) }),
    });
    if (!res.ok) throw new Error(`quotes: HTTP ${res.status}`);
    return res.json();
  }

  async getQuote(item) {
    return (await this.getQuotes([item]))[item.id];
  }
}

// ── Pure calculations (no I/O, easy to unit-test) ────────────────────────────

/**
 * Totals for a list given quotes.
 * @returns {{
 *   totals: { chainId, total, missing }[] sorted cheapest first,
 *   cheapest, priciest, savings,           // savings = priciest.total - cheapest.total
 *   perItem: { [itemId]: { cheapestChain, cheapestPrice, priciestPrice } },
 *   splitTotal,                            // buying every item at its cheapest chain
 *   estimatedCount, itemCount
 * }}
 */
export function computeBasket(items, quotes, chains = CHAINS) {
  const totals = chains.map((c) => ({ chainId: c.id, total: 0, missing: 0 }));
  const perItem = {};
  let splitTotal = 0;
  let estimatedCount = 0;
  let counted = 0;

  for (const item of items) {
    const q = quotes[item.id];
    if (!q) continue;
    counted += 1;
    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    if (q.estimated) estimatedCount += 1;

    let cheapestChain = null;
    let cheapestPrice = Infinity;
    let priciestPrice = 0;
    totals.forEach((t) => {
      const price = q.prices[t.chainId];
      if (price == null) { t.missing += 1; return; }
      t.total += price * qty;
      if (price < cheapestPrice) { cheapestPrice = price; cheapestChain = t.chainId; }
      if (price > priciestPrice) priciestPrice = price;
    });
    if (cheapestChain) {
      perItem[item.id] = { cheapestChain, cheapestPrice, priciestPrice, qty };
      splitTotal += cheapestPrice * qty;
    }
  }

  totals.forEach((t) => { t.total = round2(t.total); });
  const sorted = [...totals].sort((a, b) => a.missing - b.missing || a.total - b.total);
  const cheapest = sorted[0] || null;
  const priciest = sorted.length ? sorted.reduce((m, t) => (t.total > m.total ? t : m), sorted[0]) : null;

  return {
    totals: sorted,
    cheapest,
    priciest,
    savings: cheapest && priciest ? round2(priciest.total - cheapest.total) : 0,
    perItem,
    splitTotal: round2(splitTotal),
    estimatedCount,
    itemCount: counted,
  };
}

/** Factory: wraps any provider with a tiny cache so unchanged items aren't re-fetched. */
export function createPriceService(provider) {
  const cache = new Map(); // key → Quote
  const keyOf = (it) => `${it.productId || ''}|${it.name}|${it.category}`;

  return {
    provider,
    getChains: () => provider.getChains(),
    async getQuotes(items) {
      const missing = items.filter((it) => !cache.has(keyOf(it)));
      if (missing.length) {
        const fresh = await provider.getQuotes(missing);
        missing.forEach((it) => fresh[it.id] && cache.set(keyOf(it), fresh[it.id]));
      }
      return Object.fromEntries(items.map((it) => [it.id, cache.get(keyOf(it))]).filter(([, q]) => q));
    },
  };
}

// The single instance the app uses. To go live:
//   export const priceService = createPriceService(new TransparencyApiProvider({ baseUrl: 'https://…' }));
export const priceService = createPriceService(new MockPriceProvider());
