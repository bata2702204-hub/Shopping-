import { useEffect, useMemo, useState } from 'react';
import { computeBasket, loadRealPrices, quoteFor } from '../services/priceService.js';

/** Load real_prices.json once. status: 'loading' | 'ready' | 'error'. */
export function useRealData() {
  const [state, setState] = useState({ status: 'loading', db: null, error: null });
  useEffect(() => {
    let alive = true;
    loadRealPrices()
      .then((db) => alive && setState({ status: 'ready', db, error: null }))
      .catch((error) => alive && setState({ status: 'error', db: null, error }));
    return () => { alive = false; };
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
