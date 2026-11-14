// Israeli supermarket chains, in the same order as `chainOrder` in public/real_prices.json.
export const CHAINS = [
  { id: 'shufersal', name: 'שופרסל', short: 'שופרסל', color: '#e30613' },
  { id: 'ramiLevy', name: 'רמי לוי', short: 'רמי לוי', color: '#0057b8' },
  { id: 'victory', name: 'ויקטורי', short: 'ויקטורי', color: '#f59e0b' },
  { id: 'yochananof', name: 'יוחננוף', short: 'יוחננוף', color: '#16a34a' },
  { id: 'tivTaam', name: 'טיב טעם', short: 'טיב טעם', color: '#7c3aed' },
  { id: 'carrefour', name: 'קרפור', short: 'קרפור', color: '#1e3a8a' },
];

export const CHAIN_IDS = CHAINS.map((c) => c.id);
export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
