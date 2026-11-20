import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Plus, PlusCircle, RotateCw, Sparkles } from 'lucide-react';
import { categorize } from '../services/categorizer.js';
import { exactReal, searchReal } from '../services/realSearch.js';
import { normalize } from '../services/hebrew.js';
import { CHAIN_BY_ID } from '../data/chains.js';
import { parseQuickAdd } from '../utils/format.js';
import { getCategory } from '../data/categories.js';
import { CategoryBadge, Price } from './ui.jsx';

/** Real price summary for a suggestion: cheapest real price and where. */
function PriceHint({ product }) {
  if (product.minPrice == null) return <span>אין מחיר</span>;
  const chains = Object.entries(product.prices).filter(([, v]) => v != null);
  return (
    <span>
      <Price value={product.minPrice} />
      {chains.length === 1 ? ` · ${CHAIN_BY_ID[chains[0][0]].short}` : ` · ב-${chains.length} רשתות`}
    </span>
  );
}

export default function QuickAdd({ onAdd, db, status = 'ready', onRetry }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [flash, setFlash] = useState(null); // [{ name, category, linked }]
  const inputRef = useRef(null);
  const flashTimer = useRef(null);

  // Suggest on the last comma-separated chunk only (minus a leading quantity).
  const lastChunk = text.split(',').pop().trim();
  const typed = parseQuickAdd(lastChunk)[0]?.name || '';
  // Searching ~40k real products takes ~100ms: defer it so typing stays smooth.
  const deferredTyped = useDeferredValue(typed);
  const suggestions = useMemo(() => (focused && db ? searchReal(db, deferredTyped, 10) : []), [deferredTyped, focused, db]);

  // Free-text row: add exactly what was typed (no price until a real product is chosen).
  const create = useMemo(() => {
    if (!focused || normalize(typed).length < 2) return null;
    if (suggestions.some((r) => r.product.nameNorm === normalize(typed))) return null;
    return { name: typed, category: categorize(typed).category };
  }, [typed, focused, suggestions]);

  const commit = (entries) => {
    if (!entries.length) return;
    const added = onAdd(entries);
    setText('');
    clearTimeout(flashTimer.current);
    setFlash(added.map((i) => ({ name: i.name, category: i.category, linked: Boolean(i.barcode) })));
    flashTimer.current = setTimeout(() => setFlash(null), 3200);
    inputRef.current?.focus();
  };

  // Enter: every chunk is added; a chunk that is exactly a real product name is linked to it.
  const submit = () => commit(parseQuickAdd(text).map((e) => ({ ...e, product: exactReal(db, e.name) })));

  // Picking a suggestion links the last chunk to that real product.
  const pick = (product) => {
    const parts = parseQuickAdd(text);
    const last = parts.pop();
    commit([...parts.map((e) => ({ ...e, product: exactReal(db, e.name) })), { name: product.name, qty: last?.qty || 1, product }]);
  };

  return (
    <div className="relative">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="card flex items-center gap-2 p-2 transition focus-within:ring-2 focus-within:ring-emerald-500"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          enterKeyHint="done"
          autoComplete="off"
          aria-label="הוספת מוצר"
          placeholder="חפשו מוצר: חלב, קוטג, במבה…"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          aria-label="הוסף"
          disabled={!text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-90 disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </form>

      {(suggestions.length > 0 || create) && (
        <ul className="card absolute inset-x-0 top-full z-30 mt-2 max-h-[55vh] overflow-y-auto overscroll-contain p-1 animate-slide-in" role="listbox">
          {/* Prices not here yet (slow mobile data) or failed: say so, instead of an empty list. */}
          {!db && status !== 'error' && (
            <li className="flex items-center gap-3 px-3 py-3 text-sm text-slate-500 dark:text-slate-400" data-testid="prices-loading">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-600" />
              <span>טוען מחירים אמיתיים… התוצאות יופיעו כאן עוד רגע</span>
            </li>
          )}
          {!db && status === 'error' && (
            <li className="flex items-center gap-3 px-3 py-3 text-sm" data-testid="prices-error">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <span className="flex-1">לא ניתן לטעון את המחירים. בדקו את החיבור לאינטרנט.</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onRetry}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">
                <RotateCw className="h-3.5 w-3.5" /> נסה שוב
              </button>
            </li>
          )}
          {suggestions.map(({ product: p }) => (
            <li key={p.barcode}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${getCategory(p.category).dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.fresh && <span className="chip shrink-0 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">השוואה לפי שם</span>}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {[p.manufacturer, p.unit].filter(Boolean).join(' · ')}{(p.manufacturer || p.unit) && ' · '}<PriceHint product={p} />
                  </span>
                </span>
                <CategoryBadge id={p.category} />
              </button>
            </li>
          ))}
          {create && (
            <li className={suggestions.length ? 'mt-1 border-t border-slate-100 pt-1 dark:border-slate-800' : ''}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={submit}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              >
                <PlusCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">הוסף "{create.name}" לרשימה</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">ללא מחיר — בחרו מוצר מהרשימה כדי להשוות</span>
                </span>
                <CategoryBadge id={create.category} />
              </button>
            </li>
          )}
        </ul>
      )}

      {flash && !suggestions.length && !create && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs animate-slide-in" aria-live="polite">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-slate-500 dark:text-slate-400">נוסף:</span>
          {flash.map((f, i) => (
            <span key={i} className={`chip ${getCategory(f.category).badge}`}>
              {f.name} ← {getCategory(f.category).name}{!f.linked && ' · ללא מחיר'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
