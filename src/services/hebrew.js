// Hebrew text normalization helpers shared by the categorizer and product search.

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

/** Lower-noise form: no niqqud, unified geresh/gershayim, no punctuation, single spaces. */
export function normalize(text = '') {
  return String(text)
    .replace(/[֑-ׇ]/g, '') // niqqud & cantillation
    .replace(/[׳`’']/g, "'")
    .replace(/[״“”"]/g, '"')
    .replace(/[^א-תa-zA-Z0-9'"%\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rough singular stem of one Hebrew word: finals → regular, plural/feminine suffixes stripped.
 * עגבניה / עגבנייה / עגבניות → עגבנ ; פעמי / פעמיות / פעמיים → פעמ ; ביצה / ביצים → ביצ
 */
export function stemWord(word) {
  let w = word.replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/["']/g, '');
  w = w.replace(/יי/g, 'י').replace(/וו/g, 'ו');
  if (w.length > 3 && (w.endsWith('ימ') || w.endsWith('ות'))) w = w.slice(0, -2);
  else if (w.length > 2 && w.endsWith('ה')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('י')) w = w.slice(0, -1);
  return w;
}

/** Levenshtein distance, bailing out early once it exceeds `max`. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Phrase key: each word stemmed. Optionally drops a leading ה/ו prefix (only for the user's input). */
export function phraseKey(text, { dropPrefix = false } = {}) {
  return normalize(text)
    .split(' ')
    .filter(Boolean)
    .map((w) => (dropPrefix && w.length > 3 && /^[הו]/.test(w) ? w.slice(1) : w))
    .map(stemWord)
    .join(' ');
}

/** True if `needle` appears in `hay` on word boundaries (both are phrase keys). */
export function containsPhrase(hay, needle) {
  if (!needle) return false;
  return ` ${hay} `.includes(` ${needle} `);
}
