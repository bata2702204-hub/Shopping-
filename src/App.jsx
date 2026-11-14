import { useCallback, useEffect, useRef, useState } from 'react';
import { ListChecks, Moon, Scale, ShoppingCart, Sun, Undo2 } from 'lucide-react';
import { useShopping } from './store/ShoppingContext.jsx';
import { usePrices, useTheme } from './hooks/usePrices.js';
import ListView from './components/ListView.jsx';
import CompareView from './components/CompareView.jsx';
import ShopView from './components/ShopView.jsx';

const TABS = [
  { id: 'list', label: 'הרשימה', icon: ListChecks },
  { id: 'compare', label: 'השוואת מחירים', icon: Scale },
  { id: 'shop', label: 'מצב קניות', icon: ShoppingCart },
];

const readTab = () => {
  const h = location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'list';
};

export default function App() {
  const shop = useShopping();
  const prices = usePrices(shop.items);
  const [dark, toggleTheme] = useTheme();
  const [tab, setTabState] = useState(readTab);
  const [toastState, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const onHash = () => setTabState(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setTab = (id) => {
    if (id !== tab) history.pushState(null, '', `#${id}`);
    setTabState(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toast = useCallback((message, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ message, undo, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const remaining = shop.items.filter((i) => !i.checked).length;
  const current = TABS.find((t) => t.id === tab);

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-[60px] max-w-xl items-center gap-3 px-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md shadow-emerald-600/25">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="flex-1 leading-tight">
            <h1 className="text-lg font-extrabold tracking-tight">סל חכם</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{current.label}{shop.items.length > 0 && ` · ${remaining} נותרו`}</p>
          </div>
          <button type="button" onClick={toggleTheme} className="icon-btn" aria-label={dark ? 'מצב בהיר' : 'מצב כהה'}>
            <span key={String(dark)} className="animate-pop">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4">
        <div key={tab} className="animate-fade-up">
          {tab === 'list' && <ListView prices={prices} toast={toast} goCompare={() => setTab('compare')} />}
          {tab === 'compare' && <CompareView prices={prices} goList={() => setTab('list')} goShop={() => setTab('shop')} />}
          {tab === 'shop' && <ShopView prices={prices} toast={toast} goList={() => setTab('list')} />}
        </div>
      </main>

      {toastState && (
        <div key={toastState.key} role="status"
          className="fixed bottom-24 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl animate-toast-in dark:bg-slate-100 dark:text-slate-900">
          <span className="flex-1">{toastState.message}</span>
          {toastState.undo && (
            <button type="button" onClick={() => { toastState.undo(); setToast(null); }}
              className="flex items-center gap-1 font-bold text-emerald-400 dark:text-emerald-600">
              <Undo2 className="h-4 w-4" /> בטל
            </button>
          )}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/90 pb-safe backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/90">
        <div className="mx-auto grid max-w-xl grid-cols-3 px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} type="button" onClick={() => setTab(id)} aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-all duration-300 ${active ? 'bg-emerald-100 dark:bg-emerald-500/15' : ''}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {label}
                {id === 'list' && remaining > 0 && (
                  <span className="absolute right-[calc(50%-30px)] top-1.5 min-w-[18px] rounded-full bg-emerald-600 px-1 text-[10px] leading-[18px] text-white">{remaining}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
