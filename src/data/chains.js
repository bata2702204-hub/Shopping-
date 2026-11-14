// Israeli supermarket chains. `id` keys match the price maps in products.mock.js
// and must match whatever a real provider returns.
export const CHAINS = [
  { id: 'shufersal', name: 'שופרסל', short: 'שופרסל', color: '#e30613' },
  { id: 'ramiLevy', name: 'רמי לוי', short: 'רמי לוי', color: '#0057b8' },
  { id: 'victory', name: 'ויקטורי', short: 'ויקטורי', color: '#f59e0b' },
  { id: 'yochananof', name: 'יוחננוף', short: 'יוחננוף', color: '#16a34a' },
  { id: 'tivTaam', name: 'טיב טעם', short: 'טיב טעם', color: '#7c3aed' },
];

export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
