import { useState } from 'react';
import { ChevronDown, Info, Loader2, Scale, Split, Trophy } from 'lucide-react';
import { CHAIN_BY_ID } from '../data/chains.js';
import { useShopping } from '../store/ShoppingContext.jsx';
import { fmt, fmtQty } from '../utils/format.js';
import { Button, CategoryIcon, EmptyState, Price } from './ui.jsx';

export default function CompareView({ prices, goList, goShop }) {
  const shop = useShopping();
  const { basket, quotes, loading, chains } = prices;
  const [showItems, setShowItems] = useState(true);

  if (shop.items.length === 0) {
    return (
      <EmptyState icon={Scale} title="אין מה להשוות עדיין" text="הוסיפו מוצרים לרשימה כדי לראות כמה יעלה הסל בכל רשת."
        action={<Button onClick={goList}>לרשימה</Button>} />
    );
  }

  const { cheapest, priciest, totals, savings, splitTotal } = basket;
  const max = Math.max(...totals.map((t) => t.total), 1);
  const splitSaving = cheapest ? Math.round((cheapest.total - splitTotal) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      {/* Hero */}
      {cheapest && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white shadow-xl shadow-emerald-700/20 animate-fade-up">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm text-emerald-50/90">
              <Trophy className="h-4 w-4" /> הסל הזול ביותר
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight">{CHAIN_BY_ID[cheapest.chainId].name}</div>
            <div className="mt-1 text-4xl font-black"><Price value={cheapest.total} /></div>
            {savings > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur">
                חיסכון של <Price value={savings} /> לעומת {CHAIN_BY_ID[priciest.chainId].name}
              </div>
            )}
            <div className="mt-2 text-xs text-emerald-50/80">
              {basket.itemCount} מוצרים · {shop.items.reduce((s, i) => s + Number(i.qty || 1), 0).toLocaleString('he-IL')} יחידות
            </div>
          </div>
        </div>
      )}

      {/* Chain ranking */}
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {totals.map((t, i) => {
          const chain = CHAIN_BY_ID[t.chainId];
          const diff = cheapest ? t.total - cheapest.total : 0;
          const isBest = i === 0;
          const selected = shop.selectedChain === t.chainId;
          return (
            <div key={t.chainId} className="p-4 animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  isBest ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {isBest ? <Trophy className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: chain.color }} />
                    <span className="font-bold">{chain.name}</span>
                    {isBest && <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">הכי זול</span>}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full rounded-full transition-all duration-700 ${isBest ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      style={{ width: `${(t.total / max) * 100}%` }} />
                  </div>
                </div>
                <div className="text-end">
                  <div className={`text-lg font-extrabold ${isBest ? 'text-emerald-600 dark:text-emerald-400' : ''}`}><Price value={t.total} /></div>
                  {!isBest && <div className="text-xs font-semibold text-rose-500">+<Price value={diff} /></div>}
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => { shop.selectChain(t.chainId); goShop(); }}
                  className={`text-xs font-semibold transition ${selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}>
                  {selected ? '✓ נבחרה לקנייה' : 'קנה ברשת זו ←'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Split shopping tip */}
      {splitSaving > 0.5 && (
        <div className="card flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Split className="h-5 w-5" /></span>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <b className="text-slate-900 dark:text-white">טיפ: קנייה מפוצלת.</b> אם קונים כל מוצר ברשת הזולה ביותר עבורו, הסל עולה <Price value={splitTotal} className="font-bold" /> – חיסכון נוסף של <Price value={splitSaving} className="font-bold text-emerald-600 dark:text-emerald-400" />.
          </p>
        </div>
      )}

      {/* Per-item table */}
      <div className="card overflow-hidden">
        <button type="button" onClick={() => setShowItems((s) => !s)} className="flex w-full items-center justify-between p-4 font-bold">
          השוואה לפי מוצר
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${showItems ? 'rotate-180' : ''}`} />
        </button>
        {showItems && (
          <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  {chains.map((c) => (
                    <th key={c.id} className="px-0.5 py-2 text-center text-[10px] font-semibold leading-tight">
                      <span className="mx-auto mb-0.5 block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Each product: a full-width name line, then one price per chain (₪). */}
              {shop.items.map((item) => {
                const q = quotes[item.id];
                const best = basket.perItem[item.id];
                return (
                  <tbody key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                    <tr>
                      <td colSpan={chains.length} className="px-3 pb-0.5 pt-2.5">
                        <div className="flex items-center gap-1.5 text-[13px] font-medium">
                          <CategoryIcon id={item.category} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0 text-[11px] font-normal text-slate-400">×{fmtQty(item.qty)}</span>
                          {q?.estimated && <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">משוער</span>}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      {chains.map((c) => {
                        const price = q?.prices[c.id];
                        const isMin = best && price === best.cheapestPrice;
                        const isMax = best && price === best.priciestPrice && best.priciestPrice !== best.cheapestPrice;
                        return (
                          <td key={c.id} className="px-0.5 pb-2.5 pt-1 text-center">
                            {price == null ? <span className="text-slate-300">—</span> : (
                              <span className={`inline-block rounded-md px-1 py-0.5 text-[11px] font-semibold ${
                                isMin ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : isMax ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                <span className="tabular-nums">{fmt(price * (Number(item.qty) || 1))}</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <td colSpan={chains.length} className="px-3 pt-2 text-xs font-bold">סה״כ (₪)</td>
                </tr>
                <tr className="bg-slate-50 font-bold dark:bg-slate-800/50">
                  {chains.map((c) => {
                    const t = totals.find((x) => x.chainId === c.id);
                    return (
                      <td key={c.id} className={`px-0.5 pb-2.5 pt-1 text-center text-[11px] ${c.id === cheapest?.chainId ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        <span className="tabular-nums">{fmt(t?.total)}</span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 px-1 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        המחירים הם הדמיה ריאלית לצורך השוואה ואינם מחירים עדכניים מהרשתות.
        {basket.estimatedCount > 0 && ` ${basket.estimatedCount} מוצרים שאינם בקטלוג תומחרו לפי ממוצע המחלקה.`}
      </p>
    </div>
  );
}
