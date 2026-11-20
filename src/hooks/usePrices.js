import { useEffect, useMemo, useState } from 'react';
import { computeBasket, loadRealPrices, quoteFor } from '../services/priceService.js';

const RECHECK_MS = 30 * 60 * 1000;

/** Load real_prices.json (and re-check when the app returns to the screen). status: 'loading' | 'ready' | 'error'. */
export function useRealData() {
  const [state, setState] = useState({ status: 'loading', db: null, error: null });
  useEffect(() => {
    let alive = true;
    let loadedAt = 0;
    const load = () => {
      loadedAt = Date.now();
      loadRealPrices()
        // Keep showing the current prices while checking; swap only if the file is newer.
        .then((db) => alive && setState((prev) => (prev.db && prev.db.generatedAt === db.generatedAt
          ? prev : { status: 'ready', db, error: null })))
        .catch((error) => alive && setState((prev) => (prev.db ? prev : { status: 'error', db: null, error })));
    };
    load();
    // Phones keep the app open for days: when it comes back to the screen, re-check for new prices.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt > RECHECK_MS) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return state;
}

/** Real quotes for the list and the basket comparison derived from them. */
export function usePrices(items, db) {
  const quotes = useMemo(() => Object.fromEntries(items.map((it) => [it.id, quoteFor(db, it)])), [items, db]);
  const chains = db?.chains || [];
  const basket = useMemo(() => computeBasket(items, quotes, chains), [items, quotes, chains]);
  return { quotes, basket, chains, db };
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#f8fafc');
    try { localStorage.setItem('smart-shopping:theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}
