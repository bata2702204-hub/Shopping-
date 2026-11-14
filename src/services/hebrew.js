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

/** Rough singular stem of one Hebrew word: finals → regular, plural/feminine suffix stripped. */
export function stemWord(word) {
  let w = word.replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/["']/g, '');
  w = w.replace(/יי/g, 'י').replace(/וו/g, 'ו');
  if (w.length > 3 && (w.endsWith('ימ') || w.endsWith('ות'))) w = w.slice(0, -2);
  else if (w.length > 2 && w.endsWith('ה')) w = w.slice(0, -1);
  return w;
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
