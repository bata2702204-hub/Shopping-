import { useState } from 'react';
import { ChevronDown, Database, Info, Link2, Scale, Split, Trophy } from 'lucide-react';
import { CHAIN_BY_ID } from '../data/chains.js';
import { useShopping } from '../store/ShoppingContext.jsx';
import { fmt, fmtQty, fmtUpdated } from '../utils/format.js';
import { Button, CategoryIcon, EmptyState, Price } from './ui.jsx';

/** Why a chain has no prices today, in plain Hebrew. */
function chainStatusText(c) {
  if (c.status === 'stale') return `נתונים מ-${fmtUpdated(c.fileTime)} (העדכון היומי נכשל)`;
  if (c.status === 'ok') return null;
  if (c.status === 'disabled') return 'אין מידע — לא זמין כרגע';
  return 'אין מידע — קובץ המחירים של הרשת לא נאסף היום';
}

export default function CompareView({ prices, goList, goShop }) {
  const shop = useShopping();
  const { basket, quotes, chains, db } = prices;
  const [showItems, setShowItems] = useState(true);

  if (shop.items.length === 0) {
    return (
      <EmptyState icon={Scale} title="אין מה להשוות עדיין" text="הוסיפו מוצרים לרשימה כדי לראות כמה יעלה הסל בכל רשת."
        action={<Button onClick={goList}>לרשימה</Button>} />
    );
  }

  const { cheapest, priciest, totals, savings, splitTotal, splitComplete, linkedCount, unlinked } = basket;
  const dataChains = chains.filter((c) => c.hasData);
  const chainMeta = Object.fromEntries(chains.map((c) => [c.id, c]));
  const max = Math.max(...totals.map((t) => t.total), 1);
  // Full-basket winner only when 2+ chains carry everything; otherwise the common-products comparison.
  const showFull = Boolean(priciest) || (cheapest && !basket.common);
  const splitSaving = cheapest && splitComplete ? Math.round((cheapest.total - splitTotal) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      {/* Hero */}
      {showFull ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white shadow-xl shadow-emerald-700/20 animate-fade-up">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm text-emerald-50/90">
              <Trophy className="h-4 w-4" /> {priciest ? 'הסל הזול ביותר' : 'עלות הסל (רק רשת אחת עם נתונים מלאים)'}
            </div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight">{CHAIN_BY_ID[cheapest.chainId].name}</div>
            <div className="mt-1 text-4xl font-black"><Price value={cheapest.total} /></div>
            {savings > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur">
                חיסכון של <Price value={savings} /> לעומת {CHAIN_BY_ID[priciest.chainId].name}
              </div>
            )}
            <div className="mt-2 text-xs text-emerald-50/80">
              {linkedCount} מוצרים עם מחיר אמיתי{unlinked.length > 0 && ` · ${unlinked.length} ללא מוצר מקושר`}
            </div>
          </div>
        </div>
      ) : basket.common ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white shadow-xl shadow-emerald-700/20 animate-fade-up" data-testid="common-hero">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm text-emerald-50/90">
              <Trophy className="h-4 w-4" /> הזולה ביותר על {basket.common.count} מוצרים שנמכרים בכל הרשתות
            </div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight">{CHAIN_BY_ID[basket.common.cheapest.chainId].name}</div>
            <div className="mt-1 text-4xl font-black"><Price value={basket.common.cheapest.total} /></div>
            {basket.common.savings > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur">
                חיסכון של <Price value={basket.common.savings} /> לעומת {CHAIN_BY_ID[basket.common.priciest.chainId].name}
              </div>
            )}
            <div className="mt-2 text-xs text-emerald-50/80">
              {linkedCount - basket.common.count} מוצרים אחרים בסל לא נמכרים בכל הרשתות (למשל ירקות, בשר ומותג פרטי עם ברקוד של הרשת) ולא נכללו בסכום הזה.
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {basket.common.totals.map((t) => (
                <span key={t.chainId} className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                  {CHAIN_BY_ID[t.chainId].short}: <Price value={t.total} />
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center">
          <div className="font-bold">אין עדיין השוואה מלאה</div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {linkedCount === 0
              ? 'בחרו מוצרים אמיתיים מהחיפוש (או קשרו פריטים קיימים) כדי לראות מחירים.'
              : 'לאף רשת אין מחיר אמיתי לכל המוצרים בסל. הפירוט לפי רשת ולפי מוצר מופיע למטה.'}
          </p>
        </div>
      )}

      {/* Chain ranking */}
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {totals.map((t, i) => {
          const chain = CHAIN_BY_ID[t.chainId];
          const meta = chainMeta[t.chainId];
          const isBest = cheapest && t.chainId === cheapest.chainId && priciest;
          const selected = shop.selectedChain === t.chainId;
          const statusText = chainStatusText(meta);
          return (
            <div key={t.chainId} className={`p-4 animate-fade-up ${t.hasData ? '' : 'opacity-60'}`} style={{ animationDelay: `${i * 40}ms` }} data-chain={t.chainId}>
              <div className="flex items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  isBest ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {isBest ? <Trophy className="h-4 w-4" /> : t.complete ? i + 1 : '–'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: chain.color }} />
                    <span className="font-bold">{chain.name}</span>
                    {isBest && <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">הכי זול</span>}
                  </div>
                  {t.hasData && t.complete && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full transition-all duration-700 ${isBest ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        style={{ width: `${(t.total / max) * 100}%` }} />
                    </div>
                  )}
                  {t.hasData && !t.complete && linkedCount > 0 && (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {t.missing === linkedCount ? 'אף מוצר מהסל לא קיים בקובץ של הרשת' : `${t.missing} מוצרים מהסל לא קיימים ברשת`}
                    </div>
                  )}
                  {statusText && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{statusText}</div>}
                </div>
                <div className="text-end">
                  {t.hasData && t.total > 0 ? (
                    <>
                      <div className={`text-lg font-extrabold ${isBest ? 'text-emerald-600 dark:text-emerald-400' : ''}`}><Price value={t.total} /></div>
                      {t.complete && cheapest && !isBest && t.chainId !== cheapest.chainId && (
                        <div className="text-xs font-semibold text-rose-500">+<Price value={t.total - cheapest.total} /></div>
                      )}
                      {!t.complete && <div className="text-[11px] text-slate-400">חלקי</div>}
                    </>
                  ) : (
                    <div className="text-sm font-semibold text-slate-400">אין מידע</div>
                  )}
                </div>
              </div>
              {t.complete && (
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => { shop.selectChain(t.chainId); goShop(); }}
                    className={`text-xs font-semibold transition ${selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}>
                    {selected ? '✓ נבחרה לקנייה' : 'קנה ברשת זו ←'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unlinked items */}
      {unlinked.length > 0 && (
        <div className="card flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Link2 className="h-5 w-5" /></span>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <b className="text-slate-900 dark:text-white">לא נכללו בהשוואה:</b> {unlinked.map((i) => i.name).join(', ')}.
            {' '}לא נבחר להם מוצר אמיתי — לחצו על "בחר מוצר" ברשימה.
          </p>
        </div>
      )}

      {/* Split shopping tip — only meaningful with 2+ chains of real data */}
      {dataChains.length > 1 && splitSaving > 0.5 && (
        <div className="card flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Split className="h-5 w-5" /></span>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <b className="text-slate-900 dark:text-white">טיפ: קנייה מפוצלת.</b> אם קונים כל מוצר ברשת הזולה ביותר עבורו, הסל עולה <Price value={splitTotal} className="font-bold" /> – חיסכון נוסף של <Price value={splitSaving} className="font-bold text-emerald-600 dark:text-emerald-400" />.
          </p>
        </div>
      )}

      {/* Per-item table (chains with data only) */}
      {linkedCount > 0 && dataChains.length > 0 && (
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
                    {dataChains.map((c) => (
                      <th key={c.id} className="px-0.5 py-2 text-center text-[10px] font-semibold leading-tight">
                        <span className="mx-auto mb-0.5 block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                {shop.items.filter((it) => quotes[it.id]?.linked).map((item) => {
                  const q = quotes[item.id];
                  const best = basket.perItem[item.id];
                  return (
                    <tbody key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                      <tr>
                        <td colSpan={dataChains.length} className="px-3 pb-0.5 pt-2.5">
                          <div className="flex items-center gap-1.5 text-[13px] font-medium">
                            <CategoryIcon id={item.category} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{q.product.name}</span>
                            <span className="shrink-0 text-[11px] font-normal text-slate-400">×{fmtQty(item.qty)}</span>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        {dataChains.map((c) => {
                          const price = q.prices[c.id];
                          const isMin = best && price === best.cheapestPrice && dataChains.length > 1;
                          const isMax = best && price === best.priciestPrice && best.priciestPrice !== best.cheapestPrice;
                          return (
                            <td key={c.id} className="px-0.5 pb-2.5 pt-1 text-center">
                              {price == null ? (
                                <span className="text-[10px] text-slate-400" title="המוצר לא קיים בקובץ המחירים של הרשת">לא קיים ברשת</span>
                              ) : (
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
                    <td colSpan={dataChains.length} className="px-3 pt-2 text-xs font-bold">סה״כ (₪)</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold dark:bg-slate-800/50">
                    {dataChains.map((c) => {
                      const t = totals.find((x) => x.chainId === c.id);
                      return (
                        <td key={c.id} className={`px-0.5 pb-2.5 pt-1 text-center text-[11px] ${c.id === cheapest?.chainId ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                          <span className="tabular-nums">{fmt(t?.total)}</span>{t && !t.complete && <span className="block text-[9px] font-normal text-slate-400">חלקי</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Source */}
      <div className="flex items-start gap-2 px-1 text-xs text-slate-400">
        <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          מקור: קובצי שקיפות המחירים של הרשתות (חוק המזון), מחירי מדף ללא מבצעים.
          {db?.lastUpdated && ` עודכן ${fmtUpdated(db.lastUpdated)}.`}
          {dataChains.map((c) => c.storeName && ` ${c.name}: סניף ${c.storeName}.`).filter(Boolean).join('')}
        </span>
      </div>
      {chains.some((c) => !c.hasData) && (
        <p className="flex items-start gap-2 px-1 text-xs text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          רשתות ללא נתונים מוצגות כ"אין מידע" — לא מוצגים להן מחירים משוערים.
        </p>
      )}
    </div>
  );
}
