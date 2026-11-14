// Israeli supermarket chains. `id` keys match the price maps in the catalog
// and must match whatever a real provider returns.
// `priceIndex` = typical shelf-price level relative to Shufersal (used only by the mock price generator).
export const CHAINS = [
  { id: 'shufersal', name: 'שופרסל', short: 'שופרסל', color: '#e30613', priceIndex: 1.0 },
  { id: 'ramiLevy', name: 'רמי לוי', short: 'רמי לוי', color: '#0057b8', priceIndex: 0.8 },
  { id: 'victory', name: 'ויקטורי', short: 'ויקטורי', color: '#f59e0b', priceIndex: 0.87 },
  { id: 'yochananof', name: 'יוחננוף', short: 'יוחננוף', color: '#16a34a', priceIndex: 0.85 },
  { id: 'tivTaam', name: 'טיב טעם', short: 'טיב טעם', color: '#7c3aed', priceIndex: 1.1 },
  { id: 'carrefour', name: 'קרפור', short: 'קרפור', color: '#1e3a8a', priceIndex: 0.88 },
];

export const CHAIN_IDS = CHAINS.map((c) => c.id);
export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
