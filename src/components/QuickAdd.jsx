import { useMemo, useRef, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { suggest } from '../services/categorizer.js';
import { parseQuickAdd } from '../utils/format.js';
import { getCategory } from '../data/categories.js';
import { CategoryBadge, Price } from './ui.jsx';

export default function QuickAdd({ onAdd }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [flash, setFlash] = useState(null); // [{ name, category }]
  const inputRef = useRef(null);
  const flashTimer = useRef(null);

  // Suggest on the last comma-separated chunk only.
  const lastChunk = text.split(',').pop().trim();
  const suggestions = useMemo(() => (focused ? suggest(lastChunk, 5) : []), [lastChunk, focused]);

  const submit = (raw = text) => {
    const entries = parseQuickAdd(raw);
    if (!entries.length) return;
    const added = onAdd(entries);
    setText('');
    clearTimeout(flashTimer.current);
    setFlash(added.map((i) => ({ name: i.name, category: i.category })));
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
    inputRef.current?.focus();
  };

  const pick = (product) => {
    const parts = text.split(',');
    parts[parts.length - 1] = ` ${product.name}`;
    submit(parts.join(','));
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
          placeholder="מה צריך לקנות? למשל: חלב, ביצים, 2 עגבניות"
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

      {suggestions.length > 0 && (
        <ul className="card absolute inset-x-0 top-full z-30 mt-2 overflow-hidden p-1 animate-slide-in" role="listbox">
          {suggestions.map((p) => {
            const min = Math.min(...Object.values(p.prices));
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${getCategory(p.category).dot}`} />
                  <span className="flex-1">
                    <span className="block font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{p.unit} · מ-<Price value={min} /></span>
                  </span>
                  <CategoryBadge id={p.category} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {flash && !suggestions.length && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs animate-slide-in" aria-live="polite">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-slate-500 dark:text-slate-400">קוטלג אוטומטית:</span>
          {flash.map((f, i) => (
            <span key={i} className={`chip ${getCategory(f.category).badge}`}>
              {f.name} ← {getCategory(f.category).name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
