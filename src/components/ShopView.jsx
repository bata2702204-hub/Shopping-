import { useMemo, useState } from 'react';
import { CheckCheck, ChevronDown, Eye, EyeOff, PartyPopper, ShoppingCart } from 'lucide-react';
import { CATEGORIES } from '../data/categories.js';
import { CHAIN_BY_ID } from '../data/chains.js';
import { lookupProduct } from '../services/customProducts.js';
import { useShopping } from '../store/ShoppingContext.jsx';
import { fmtQty } from '../utils/format.js';
import { Button, CategoryIcon, Checkbox, EmptyState, Price } from './ui.jsx';

export default function ShopView({ prices, toast, goList }) {
  const shop = useShopping();
  const { quotes, basket, chains } = prices;
  const [hideDone, setHideDone] = useState(false);
  const [open, setOpen] = useState({}); // categoryId → bool (explicit user override)

  const chainId = shop.selectedChain || basket.cheapest?.chainId || chains[0].id;

  // Sections in store-walking (aisle) order.
  const sections = useMemo(() => CATEGORIES
    .map((c) => {
      const items = shop.items.filter((i) => i.category === c.id)
        .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'he'));
      return { ...c, items, done: items.filter((i) => i.checked).length };
    })
    .filter((s) => s.items.length)
    .sort((a, b) => a.aisle - b.aisle), [shop.items]);

  if (shop.items.length === 0) {
    return (
      <EmptyState icon={ShoppingCart} title="אין מוצרים לקנייה" text="הוסיפו מוצרים לרשימה ואז חזרו לכאן כשאתם בסופר."
        action={<Button onClick={goList}>לרשימה</Button>} />
    );
  }

  const total = shop.items.length;
  const done = shop.items.filter((i) => i.checked).length;
  const pct = Math.round((done / total) * 100);
  const priceOf = (i) => (quotes[i.id]?.prices[chainId] ?? 0) * (Number(i.qty) || 1);
  const cartTotal = shop.items.filter((i) => i.checked).reduce((s, i) => s + priceOf(i), 0);
  const listTotal = shop.items.reduce((s, i) => s + priceOf(i), 0);

  return (
    <div className="space-y-4">
      {/* Sticky progress + chain */}
      <div className="sticky top-[60px] z-20 -mx-4 bg-slate-50/90 px-4 pb-3 pt-1 backdrop-blur dark:bg-slate-950/90">
        <div className="card p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">התקדמות</div>
              <div className="text-2xl font-extrabold tabular-nums">{done}<span className="text-base font-semibold text-slate-400">/{total}</span></div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500 dark:text-slate-400">בעגלה · {CHAIN_BY_ID[chainId].name}</div>
              <div className="text-lg font-bold">
                <Price value={cartTotal} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-slate-400"> / <Price value={listTotal} /></span>
              </div>
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 flex-wrap gap-1.5">
              {chains.map((c) => (
                <button key={c.id} type="button" onClick={() => shop.selectChain(c.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    c.id === chainId ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.short}
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn" onClick={() => setHideDone((h) => !h)} aria-label={hideDone ? 'הצג מסומנים' : 'הסתר מסומנים'}>
              {hideDone ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {done === total && (
        <div className="card flex flex-col items-center gap-2 p-6 text-center animate-fade-up">
          <PartyPopper className="h-10 w-10 text-emerald-500 animate-pop" />
          <div className="text-lg font-bold">סיימתם את הקניות!</div>
          <div className="text-sm text-slate-500">כל {total} המוצרים בעגלה.</div>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => toast('המוצרים שנקנו הוסרו מהרשימה', shop.clearChecked())}><CheckCheck className="h-4 w-4" /> נקה רשימה</Button>
            <Button variant="soft" onClick={shop.uncheckAll}>אפס סימונים</Button>
          </div>
        </div>
      )}

      {sections.map((s, idx) => {
        const complete = s.done === s.items.length;
        const isOpen = open[s.id] ?? !complete; // finished departments collapse automatically
        const visible = hideDone ? s.items.filter((i) => !i.checked) : s.items;
        if (hideDone && !visible.length) return null;
        return (
          <section key={s.id} className={`card overflow-hidden transition-opacity ${complete ? 'opacity-70' : ''}`}>
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))}
              className={`flex w-full items-center gap-3 p-4 text-start ${s.soft}`}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold text-slate-500 shadow-sm dark:bg-slate-900">{idx + 1}</span>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${s.badge}`}><CategoryIcon id={s.id} className="h-5 w-5" /></span>
              <span className="flex-1">
                <span className="block font-bold">{s.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{complete ? 'הושלם ✓' : `${s.done} מתוך ${s.items.length}`}</span>
              </span>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((item) => {
                  const product = lookupProduct(item.productId);
                  return (
                    <li key={item.id}>
                      <div role="button" tabIndex={0} onClick={() => shop.toggle(item.id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), shop.toggle(item.id))}
                        className={`flex min-h-[64px] cursor-pointer select-none items-center gap-4 px-4 py-3 transition-all duration-300 active:bg-slate-50 dark:active:bg-slate-800 ${
                          item.checked ? 'opacity-50' : ''}`}>
                        <Checkbox size="lg" checked={item.checked} onChange={() => shop.toggle(item.id)} label={`סמן ${item.name}`} />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-lg font-semibold ${item.checked ? 'line-through decoration-2' : ''}`}>{item.name}</span>
                          {product && <span className="text-xs text-slate-500 dark:text-slate-400">{product.unit}</span>}
                        </span>
                        <span className="text-end">
                          <span className="block rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-bold tabular-nums dark:bg-slate-800">×{fmtQty(item.qty)}</span>
                          {quotes[item.id] && <Price value={priceOf(item)} className="mt-1 block text-xs text-slate-400" />}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
