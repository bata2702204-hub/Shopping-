// The catalog is a search & department DICTIONARY — not a product list and not prices.
// It tells the app that "כריות" is a breakfast cereal or "גו" is a protein-yogurt line, so free
// text can be put in the right department and searches can be expanded to real product names.
// Every product and price the app shows comes from public/real_prices.json (real
// price-transparency files); nothing here is ever displayed as a product or priced.

const split = (s) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);

/**
 * Build a department's dictionary entries from rows:
 *   [id, name, sub, aliases, brands]
 * aliases: "a|b|c" synonyms / nicknames (strong match)
 * brands : "x|y" common brands (weaker match)
 */
export function department(category, rows) {
  return rows.map(([id, name, sub, aliases, brands]) => ({
    id, name, category, sub, aliases: split(aliases), brands: split(brands),
  }));
}
