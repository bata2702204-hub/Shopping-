// ─────────────────────────────────────────────────────────────────────────────
// Price service — REAL prices only.
//
// The single source of products and prices is real_prices.json, produced daily by
// scripts/fetch_real_prices.py (+ scripts/enrich_prices.mjs) from the chains' official
// price-transparency files (חוק המזון). Products are compared by barcode. When a chain's file
// doesn't list a barcode, that price is null and the UI says so — nothing is estimated.
// ─────────────────────────────────────────────────────────────────────────────

import { CHAINS } from '../data/chains.js';
import { normalize } from './hebrew.js';

const round2 = (n) => Math.round(n * 100) / 100;
const OK = new Set(['ok', 'stale']);

/** Turn the compact JSON into a usable in-memory database. */
export function parseRealPrices(json) {
  const fields = json.fields || [];
  const at = (name) => fields.indexOf(name);
  const [iB, iN, iM, iU, iW, iP, iC, iD] = ['barcode', 'name', 'manufacturer', 'unit', 'weighted', 'prices', 'category', 'dictId'].map(at);
  const order = json.chainOrder || [];
  const slot = Object.fromEntries(CHAINS.map((c) => [c.id, order.indexOf(c.id)]));

  const chainMeta = Object.fromEntries((json.chains || []).map((c) => [c.id, c]));
  const chains = CHAINS.map((c) => {
    const meta = chainMeta[c.id] || { status: 'missing' };
    return { ...c, ...meta, name: c.name, hasData: OK.has(meta.status) };
  });

  const products = (json.products || []).map((row) => {
    const prices = Object.fromEntries(CHAINS.map((c) => {
      const v = slot[c.id] >= 0 ? row[iP]?.[slot[c.id]] : null;
      return [c.id, typeof v === 'number' && v > 0 ? v : null];
    }));
    const available = Object.values(prices).filter((v) => v != null);
    const name = row[iN] || '';
    const manufacturer = iM >= 0 ? row[iM] || '' : '';
    return {
      barcode: String(row[iB]),
      name,
      manufacturer,
      unit: iU >= 0 ? row[iU] || '' : '',
      weighted: iW >= 0 ? Boolean(row[iW]) : false,
      prices,
      category: (iC >= 0 && row[iC]) || 'other',
      dictId: (iD >= 0 && row[iD]) || null,
      chainCount: available.length,
      minPrice: available.length ? Math.min(...available) : null,
      norm: normalize(`${name} ${manufacturer}`),
      nameNorm: normalize(name),
    };
  });

  return {
    products,
    byBarcode: new Map(products.map((p) => [p.barcode, p])),
    chains,
    lastUpdated: json.lastUpdated || null,
    generatedAt: json.generatedAt || null,
    source: json.source || '',
  };
}

/** Load real_prices.json (deployed next to index.html). */
export async function loadRealPrices(url = 'real_prices.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`real_prices.json: HTTP ${res.status}`);
  return parseRealPrices(await res.json());
}

/**
 * Quote for one list item. Unlinked items (no real product chosen) have no prices.
 * @returns {{ linked: boolean, product: object|null, prices: { [chainId]: number|null } }}
 */
export function quoteFor(db, item) {
  const product = item.barcode && db ? db.byBarcode.get(String(item.barcode)) : null;
  const prices = Object.fromEntries(CHAINS.map((c) => [c.id, product ? product.prices[c.id] : null]));
  return { linked: Boolean(product), product, prices };
}

/**
 * Basket comparison from real prices only.
 * A chain is "complete" when it has data and a real price for every linked item; only complete
 * chains are ranked and used for "cheapest" / savings. Partial chains report what's missing.
 */
export function computeBasket(items, quotes, chains = CHAINS.map((c) => ({ ...c, hasData: true }))) {
  const linkedItems = items.filter((it) => quotes[it.id]?.linked);
  const unlinked = items.filter((it) => !quotes[it.id]?.linked);

  const totals = chains.map((c) => {
    let total = 0;
    let missing = 0;
    for (const it of linkedItems) {
      const price = quotes[it.id].prices[c.id];
      if (price == null) missing += 1;
      else total += price * (Number(it.qty) > 0 ? Number(it.qty) : 1);
    }
    return {
      chainId: c.id,
      hasData: Boolean(c.hasData),
      total: round2(total),
      missing: c.hasData ? missing : linkedItems.length,
      complete: Boolean(c.hasData) && linkedItems.length > 0 && missing === 0,
    };
  });

  const complete = totals.filter((t) => t.complete).sort((a, b) => a.total - b.total);
  const cheapest = complete[0] || null;
  const priciest = complete.length > 1 ? complete[complete.length - 1] : null;

  const perItem = {};
  let splitTotal = 0;
  let splitComplete = linkedItems.length > 0;
  for (const it of linkedItems) {
    const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
    let cheapestChain = null;
    let cheapestPrice = Infinity;
    let priciestPrice = 0;
    for (const c of chains) {
      const price = quotes[it.id].prices[c.id];
      if (price == null) continue;
      if (price < cheapestPrice) { cheapestPrice = price; cheapestChain = c.id; }
      if (price > priciestPrice) priciestPrice = price;
    }
    if (cheapestChain) {
      perItem[it.id] = { cheapestChain, cheapestPrice, priciestPrice, qty };
      splitTotal += cheapestPrice * qty;
    } else {
      splitComplete = false;
    }
  }

  const ranked = [
    ...complete,
    ...totals.filter((t) => !t.complete && t.hasData).sort((a, b) => a.missing - b.missing || a.total - b.total),
    ...totals.filter((t) => !t.hasData),
  ];

  return {
    totals: ranked,
    complete,
    cheapest,
    priciest,
    savings: cheapest && priciest ? round2(priciest.total - cheapest.total) : 0,
    perItem,
    splitTotal: round2(splitTotal),
    splitComplete,
    linkedCount: linkedItems.length,
    unlinked,
    itemCount: items.length,
  };
}
