import { useDeferredValue, useMemo, useState } from 'react';
import { ChevronLeft, ClipboardList, Link2, Pencil, RotateCcw, Search, Trash2, TrendingDown, Unlink, Wand2 } from 'lucide-react';
import { CATEGORIES, getCategory } from '../data/categories.js';
import { CHAIN_BY_ID } from '../data/chains.js';
import { categorize } from '../services/categorizer.js';
import { searchReal } from '../services/realSearch.js';
import { SAMPLE_TERMS, useShopping } from '../store/ShoppingContext.jsx';
import QuickAdd from './QuickAdd.jsx';
import { Button, CategoryBadge, CategoryIcon, Checkbox, EmptyState, Price, Sheet, Stepper } from './ui.jsx';

export default function ListView({ prices, toast, goCompare }) {
  const shop = useShopping();
  const { basket, quotes, db } = prices;
  const [editing, setEditing] = useState(null);

  const groups = useMemo(() => {
    const by = {};
    shop.items.forEach((it) => { (by[it.category] ||= []).push(it); });
    return CATEGORIES.filter((c) => by[c.id]).map((c) => ({
      ...c,
      items: [...by[c.id]].sort((a, b) => Number(a.checked) - Number(b.checked)),
    }));
  }, [shop.items]);

  const checkedCount = shop.items.filter((i) => i.checked).length;

  const remove = (item) => {
    const undo = shop.remove(item.id);
    toast(`"${item.name}" נמחק`, undo);
  };

  // Example list: each term becomes the top REAL product found for it.
  // Prefers products sold in the most chains, so the comparison has something to compare.
  const loadSample = () => shop.addMany(SAMPLE_TERMS
    .map(([term, qty]) => {
      const hits = searchReal(db, term, 8).map((r) => r.product);
      const best = hits.reduce((a, p) => (!a || p.chainCount > a.chainCount ? p : a), null);
      return { name: term, qty, product: best };
    })
    .filter((e) => e.product));

  return (
    <div className="space-y-4">
      <QuickAdd onAdd={shop.addMany} db={db} status={prices.status} onRetry={prices.retry} />

      {shop.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="הרשימה ריקה"
          text="חפשו מוצרים בשדה למעלה ובחרו מוצר מהרשימה – המחירים הם מחירים אמיתיים מקובצי השקיפות של הרשתות."
          action={db && (
            <Button variant="soft" onClick={loadSample}>
              <Wand2 className="h-4 w-4" /> טען רשימה לדוגמה
            </Button>
          )}
        />
      ) : (
        <>
          {!basket.priciest && basket.common && (
            <button
              type="button"
              onClick={goCompare}
              className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-600 p-3.5 text-start text-white shadow-lg shadow-emerald-600/20 transition active:scale-[.99] animate-fade-up"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20"><TrendingDown className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-emerald-50/90">על {basket.common.count} מוצרים שנמכרים בכל הרשתות</span>
                <span className="block truncate font-bold">
                  {CHAIN_BY_ID[basket.common.cheapest.chainId].name} – <Price value={basket.common.cheapest.total} />
                </span>
                {basket.common.savings > 0 && (
                  <span className="block text-xs text-emerald-50/90">
                    חיסכון של <Price value={basket.common.savings} /> לעומת {CHAIN_BY_ID[basket.common.priciest.chainId].name}
                  </span>
                )}
              </span>
              <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-1" />
            </button>
          )}

          {basket.cheapest && (basket.priciest || !basket.common) && (
            <button
              type="button"
              onClick={goCompare}
              className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-600 p-3.5 text-start text-white shadow-lg shadow-emerald-600/20 transition active:scale-[.99] animate-fade-up"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20"><TrendingDown className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-emerald-50/90">{basket.priciest ? 'הסל הזול ביותר' : 'עלות הסל'}</span>
                <span className="block truncate font-bold">
                  {CHAIN_BY_ID[basket.cheapest.chainId].name} – <Price value={basket.cheapest.total} />
                </span>
                {basket.savings > 0 && (
                  <span className="block text-xs text-emerald-50/90">
                    חיסכון של <Price value={basket.savings} /> לעומת {CHAIN_BY_ID[basket.priciest.chainId].name}
                  </span>
                )}
              </span>
              <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-1" />
            </button>
          )}

          {groups.map((g) => (
            <section key={g.id} className="animate-fade-up">
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                <span className={`grid h-6 w-6 place-items-center rounded-lg ${g.badge}`}><CategoryIcon id={g.id} className="h-3.5 w-3.5" /></span>
                {g.name}
                <span className="text-xs font-medium text-slate-400">({g.items.length})</span>
              </h2>
              <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                {g.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    quote={quotes[item.id]}
                    best={basket.perItem[item.id]}
                    onToggle={() => shop.toggle(item.id)}
                    onQty={(qty) => shop.update(item.id, { qty })}
                    onEdit={() => setEditing(item)}
                    onDelete={() => remove(item)}
                  />
                ))}
              </ul>
            </section>
          ))}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {checkedCount > 0 && (
              <Button variant="soft" onClick={() => toast(`${checkedCount} פריטים מסומנים נוקו`, shop.clearChecked())}>
                <RotateCcw className="h-4 w-4" /> נקה מסומנים ({checkedCount})
              </Button>
            )}
            <Button variant="danger" onClick={() => toast('הרשימה נוקתה', shop.clearAll())}>
              <Trash2 className="h-4 w-4" /> נקה הכל
            </Button>
          </div>
        </>
      )}

      <EditSheet item={editing} db={db} onClose={() => setEditing(null)} onSave={(patch) => { shop.update(editing.id, patch); setEditing(null); }} />
    </div>
  );
}

function ItemRow({ item, quote, best, onToggle, onQty, onEdit, onDelete }) {
  const product = quote?.product;
  return (
    <li
      className={`flex items-center gap-3 px-3 py-3 transition-colors duration-300 animate-slide-in ${
        item.checked ? 'bg-slate-50/80 dark:bg-slate-900/40' : ''
      }`}
    >
      <Checkbox checked={item.checked} onChange={onToggle} label={`סמן ${item.name}`} />
      <div className="min-w-0 flex-1">
        <div className={`truncate font-semibold transition ${item.checked ? 'text-slate-400 line-through decoration-2' : ''}`}>
          {item.name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {product?.unit && <span>{product.unit}</span>}
          {product && best && (
            <span className="chip bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Price value={best.cheapestPrice} /> ב{CHAIN_BY_ID[best.cheapestChain].short}
            </span>
          )}
          {product && !best && <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800">אין מידע על מחיר</span>}
          {!product && (
            <button type="button" onClick={onEdit}
              className="chip bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300">
              <Link2 className="h-3 w-3" /> בחר מוצר להשוואת מחיר
            </button>
          )}
        </div>
      </div>
      <Stepper value={item.qty} onChange={onQty} />
      <div className="flex">
        <button className="icon-btn h-8 w-8" onClick={onEdit} aria-label={`ערוך ${item.name}`}><Pencil className="h-4 w-4" /></button>
        <button className="icon-btn h-8 w-8 hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10" onClick={onDelete} aria-label={`מחק ${item.name}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function EditSheet({ item, db, onClose, onSave }) {
  return (
    <Sheet open={!!item} onClose={onClose} title="עריכת מוצר">
      {item && <EditForm key={item.id} item={item} db={db} onSave={onSave} />}
    </Sheet>
  );
}

function EditForm({ item, db, onSave }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [category, setCategory] = useState(item.category);
  const [touchedCategory, setTouchedCategory] = useState(false);
  const [barcode, setBarcode] = useState(item.barcode || null);
  const [query, setQuery] = useState(item.barcode ? '' : item.name);

  const linked = barcode && db ? db.byBarcode.get(barcode) : null;
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => (db && !linked ? searchReal(db, deferredQuery, 8) : []), [db, deferredQuery, linked]);

  const onName = (v) => {
    setName(v);
    if (!touchedCategory && !linked) setCategory(categorize(v).category); // live re-categorize
  };

  const link = (p) => {
    setBarcode(p.barcode);
    setName(p.name);
    if (!touchedCategory) setCategory(p.category);
  };

  const save = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), qty: Number(qty) > 0 ? Number(qty) : 1, category, barcode: barcode || null });
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">שם בפריט ברשימה</span>
        <input value={name} onChange={(e) => onName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800" />
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">מוצר אמיתי להשוואת מחיר</span>
        {linked ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{linked.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">ברקוד {linked.barcode}{linked.manufacturer && ` · ${linked.manufacturer}`}</span>
            </span>
            <button type="button" className="icon-btn h-8 w-8" aria-label="בטל קישור" onClick={() => { setBarcode(null); setQuery(name); }}>
              <Unlink className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש מוצר אמיתי"
                placeholder="חפשו את המוצר בקובצי הרשתות" className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none" />
            </div>
            <ul className="mt-1 max-h-48 overflow-y-auto">
              {results.map(({ product: p }) => (
                <li key={p.barcode}>
                  <button type="button" onClick={() => link(p)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.minPrice != null && <Price value={p.minPrice} className="text-xs text-slate-500" />}
                  </button>
                </li>
              ))}
              {query.trim().length >= 2 && !results.length && <li className="px-2 py-2 text-xs text-slate-400">לא נמצא מוצר תואם בקובצי הרשתות</li>}
            </ul>
          </>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">כמות</span>
        <div className="flex items-center gap-3">
          <Stepper value={Number(qty) || 1} onChange={setQty} step={1} />
          <input type="number" inputMode="decimal" min="0.1" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)}
            aria-label="כמות מדויקת"
            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800" />
        </div>
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">מחלקה</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => { setCategory(c.id); setTouchedCategory(true); }}
              className={`rounded-full transition active:scale-95 ${category === c.id ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'opacity-70 hover:opacity-100'}`}>
              <CategoryBadge id={c.id} className="px-3 py-1 text-xs" />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">זוהה אוטומטית: {getCategory(linked ? linked.category : categorize(name).category).name}</p>
      </div>
      <Button type="submit" className="w-full py-3">שמור</Button>
    </form>
  );
}
