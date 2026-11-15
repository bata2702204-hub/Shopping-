// Name-based matching for FRESH items (produce, meat, fish).
//
// Each chain sells these under its own internal code ("עגבניה" is 7290000000022 at Shufersal,
// 7290000000100 at Rami Levy, "725" at Yochananof, "4412784" at Tiv Taam), so barcodes can't compare
// them. For a curated list of basic fresh items, this picks in every chain the REAL item that is the
// plain version of it (sold by kg), using strict rules, and groups them. Prices are the chains' own;
// nothing is computed or estimated. Every match is kept so the app can show what was matched.

import { normalize, stemWord } from '../src/services/hebrew.js';

// Words that describe packaging/branding, not the product — ignored when comparing names.
const FILLER = new Set([
  'במשקל', 'משקל', 'ארוז', 'ארוזה', 'ארוזים', 'שקיל', 'טרי', 'טריה', 'טרייה', 'טריים', 'טריות',
  'ק"ג', 'קג', 'לק"ג', 'ק', 'יבש', 'יבשה', 'בתפזורת', 'מובחר', 'כשר', 'מהדרין', 'ישראלי', 'סוג', 'א',
  'עצמי', 'במגש', 'מגש', 'שופרסל', 'דיל', 'רמי', 'לוי', 'יוחננוף', 'טיב', 'טעם', 'קרפור', 'ויקטורי',
]);

// Modifiers that make it a different product (variety, processing, premium line …).
const COMMON_EXCLUDE = [
  'אורגני', 'אורגנית', 'אורגניות', 'אורגניים', 'קפוא', 'קפואה', 'קפואים', 'מעושן', 'מעושנת', 'מטוגן',
  'מיובש', 'מיובשת', 'צ\'יפס', 'ציפס', 'חתוך', 'חתוכה', 'קצוץ', 'במלח', 'בחומץ', 'חמוץ', 'כבוש',
  'פרימיום', 'בגריל', 'צלוי', 'קלוי', 'אפוי', 'לולו', 'מבושל', 'ממולא', 'ממולאים', 'מתובל', 'במרינדה',
  'שניצל', 'מוכן', 'סלט', 'מחית', 'ריבה', 'מסוכר', 'בשוקולד', 'טבעוני', 'צמחי', 'פרוס', 'פרוסות',
  'בייבי', 'מיני', 'משקה', 'מיץ', 'ממרח', 'שימורים', 'קציצות', 'מגורד',
  'חסלט', 'קטיף', 'לוקס', 'מחפ', 'מחפוד', 'נוצות', // pre-cleaned / premium / premium-kashrut lines
];

// How many extra descriptive words a match may have (beyond fillers). Produce: none — varieties and
// brand lines ("אגס אנגו", "כרובית קטיף") are different products. Meat names carry packaging/kashrut codes.
const MAX_EXTRA = { produce: 0, meat: 2 };

/**
 * Curated fresh items. heads: phrases the name must start with (any of them).
 * exclude: extra words that disqualify a candidate for this item.
 */
export const FRESH_ITEMS = [
  // ── ירקות ──
  { id: 'tomato', name: 'עגבניה', category: 'produce', heads: ['עגבניה'], exclude: ['שרי', 'מגי', 'תמר', 'אשכולות', 'מיקס', 'לובלו', 'רסק', 'מרוסקות'] },
  { id: 'cucumber', name: 'מלפפון', category: 'produce', heads: ['מלפפון'], exclude: [] },
  { id: 'onion', name: 'בצל יבש', category: 'produce', heads: ['בצל'], exclude: ['אדום', 'סגול', 'ירוק', 'פנינה', 'שאלוט', 'שלוט', 'בצלצל'] },
  { id: 'red-onion', name: 'בצל אדום', category: 'produce', heads: ['בצל אדום', 'בצל סגול'], exclude: [] },
  { id: 'potato', name: 'תפוח אדמה', category: 'produce', maxExtra: 1, heads: ['תפוח אדמה', 'תפוחי אדמה'], exclude: ['אדום', 'כסביה', 'לאפיה', 'לאפייה', 'אפייה', 'מיקרו', 'למיקרו', 'שף', 'גורמה', 'אגו', 'בטטה', 'דוד', 'משה'] },
  { id: 'sweet-potato', name: 'בטטה', category: 'produce', heads: ['בטטה'], exclude: [] },
  { id: 'carrot', name: 'גזר', category: 'produce', heads: ['גזר'], exclude: ['גמדי'] },
  { id: 'red-pepper', name: 'פלפל אדום', category: 'produce', heads: ['פלפל אדום', 'גמבה אדומה'], exclude: ['חריף', 'שושקה', 'ננסי'] },
  { id: 'eggplant', name: 'חציל', category: 'produce', heads: ['חציל'], exclude: ['שרוף', 'בלאדי'] },
  { id: 'zucchini', name: 'קישוא', category: 'produce', heads: ['קישוא'], exclude: [] },
  { id: 'cabbage', name: 'כרוב לבן', category: 'produce', heads: ['כרוב'], exclude: ['אדום', 'סגול', 'ניצנים', 'קייל', 'נאפה', 'סיני'] },
  { id: 'cauliflower', name: 'כרובית', category: 'produce', heads: ['כרובית'], exclude: [] },
  { id: 'lemon', name: 'לימון', category: 'produce', heads: ['לימון'], exclude: ['ליים', 'ירוק'] },
  // ── פירות ──
  { id: 'banana', name: 'בננה', category: 'produce', heads: ['בננה'], exclude: ['טבעית', 'בננית'] },
  { id: 'orange', name: 'תפוז', category: 'produce', heads: ['תפוז'], exclude: ['דם'] },
  { id: 'avocado', name: 'אבוקדו', category: 'produce', heads: ['אבוקדו'], exclude: [] },
  { id: 'watermelon', name: 'אבטיח', category: 'produce', maxExtra: 1, heads: ['אבטיח'], exclude: ['גרעיני'] },
  { id: 'mango', name: 'מנגו', category: 'produce', heads: ['מנגו'], exclude: [] },
  { id: 'pear', name: 'אגס', category: 'produce', heads: ['אגס'], exclude: ['אדום', 'ארגנטינה'] },
  // ── עוף, בשר ודגים ──
  { id: 'chicken-breast', name: 'חזה עוף טרי', category: 'meat', heads: ['חזה עוף'], exclude: ['חצוי', 'בטעם', 'משק', 'ארצי'] },
  { id: 'chicken-thigh', name: 'שוקיים עוף טרי', category: 'meat', heads: ['שוקיים עוף', 'שוקיים'], exclude: ['הודו', 'עור', 'בלי', 'משק', 'ארצי', 'כרעיים'] },
  { id: 'chicken-wings', name: 'כנפיים עוף', category: 'meat', heads: ['כנפיים עוף', 'כנפי עוף', 'כנפיים'], exclude: ['הודו', 'בופלו'] },
  { id: 'whole-chicken', name: 'עוף שלם', category: 'meat', heads: ['עוף שלם'], exclude: [] },
  { id: 'pargit', name: 'פרגיות', category: 'meat', heads: ['פרגית', 'פרגיות'], exclude: ['שיפודי', 'שווארמה'], excludeExact: ['פרג'] },
  { id: 'chicken-liver', name: 'כבד עוף', category: 'meat', heads: ['כבד עוף', 'כבדי עוף'], exclude: [] },
  { id: 'ground-beef', name: 'בשר בקר טחון', category: 'meat', heads: ['בשר טחון', 'טחון בקר', 'בשר בקר טחון', 'בקר טחון'], exclude: ['ביונד', 'כבש', 'עוף', 'הודו', 'קבב', 'המבורגר', 'אנגוס', 'מעורב'] },
  { id: 'salmon', name: 'פילה סלמון', category: 'meat', heads: ['פילה סלמון', 'סלמון'], exclude: ['לקס', 'גרבלקס'] },
  // (tilapia left out: chains sell fresh fillet, skinless fillet and whole fish — not comparable)
];

const SUSPECT_RATIO = 2.5;

const words = (text) => normalize(text)
  .replace(/תפו"א/g, 'תפוח אדמה')
  .split(' ')
  .filter(Boolean);
const stems = (ws) => ws.map(stemWord);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Does `name` describe the plain version of `item`? Returns the number of extra words, or -1. */
export function matchScore(item, name) {
  const all = words(name);
  if (all.some((w) => /\d/.test(w))) return -1; // pack sizes (500 גרם, 1 ק"ג) → not the loose per-kg item
  const excluded = new Set([...COMMON_EXCLUDE, ...item.exclude].map((w) => stemWord(normalize(w))));
  const allStems = stems(all);
  if (allStems.some((s) => excluded.has(s))) return -1;
  if ((item.excludeExact || []).some((w) => all.includes(normalize(w)))) return -1;
  const meaningful = stems(all.filter((w) => !FILLER.has(w)));
  for (const head of item.heads) {
    const h = stems(words(head).filter((w) => !FILLER.has(w)));
    if (h.every((s, i) => meaningful[i] === s)) {
      const extra = meaningful.length - h.length;
      return extra <= (item.maxExtra ?? MAX_EXTRA[item.category] ?? 0) ? extra : -1;
    }
  }
  return -1;
}

/**
 * Build fresh groups from the real products.
 * products: rows [key, name, manufacturer, unit, weighted, prices[]]; chainOrder: chain ids.
 * Returns [{ id, name, category, unit, members: { chainId: key }, suspect: [chainId] }].
 */
export function buildFreshGroups(products, chainOrder) {
  const groups = [];
  for (const item of FRESH_ITEMS) {
    const members = {};
    const prices = {};
    chainOrder.forEach((cid, ci) => {
      let best = null;
      for (const row of products) {
        const price = row[5]?.[ci];
        if (price == null || !row[4]) continue; // sold by kg only
        if (row[6] && row[6] !== item.category) continue; // same department (פרגיות ≠ פרג, poppy seeds)
        const extra = matchScore(item, row[1]);
        if (extra < 0) continue;
        if (!best || extra < best.extra || (extra === best.extra && price < best.price)) best = { key: row[0], extra, price };
      }
      if (best) { members[cid] = best.key; prices[cid] = best.price; }
    });
    const chains = Object.keys(members);
    if (chains.length < 2) continue;
    // A price far from the other chains' median is flagged, not changed (and left out of comparison).
    const suspect = chains.filter((cid) => {
      const others = chains.filter((c) => c !== cid).map((c) => prices[c]);
      const m = median(others);
      return prices[cid] > m * SUSPECT_RATIO || prices[cid] < m / SUSPECT_RATIO;
    });
    groups.push({ id: item.id, name: item.name, category: item.category, unit: 'לק"ג', members, suspect });
  }
  return groups;
}
