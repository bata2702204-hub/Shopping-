import { useEffect, useMemo, useRef, useState } from 'react';
import { computeBasket, loadCachedPrices, loadRealPrices, quoteFor } from '../services/priceService.js';

const RECHECK_MS = 30 * 60 * 1000;

/**
 * Real prices for the app. Shows the copy saved on this device at once (if any), then loads the
 * current file from the site and swaps it in when it's newer. Re-checks when the app returns to the
 * screen after 30 min (phones keep it open for days).
 * status: 'loading' | 'ready' | 'error'; retry() loads again (e.g. after an error).
 */
export function useRealData() {
  const [state, setState] = useState({ status: 'loading', db: null, error: null });
  const loadRef = useRef(() => {});

  useEffect(() => {
    let alive = true;
    let loadedAt = 0;
    const newer = (prev, db) => !prev.db || prev.db.generatedAt !== db.generatedAt;

    const load = () => {
      loadedAt = Date.now();
      setState((prev) => (prev.db ? prev : { status: 'loading', db: null, error: null }));
      loadRealPrices()
        .then((db) => alive && setState((prev) => (newer(prev, db) ? { status: 'ready', db, error: null } : prev)))
        .catch((error) => alive && setState((prev) => (prev.db ? prev : { status: 'error', db: null, error })));
    };
    loadRef.current = load;

    loadCachedPrices().then((db) => {
      if (alive && db) setState((prev) => (prev.db ? prev : { status: 'ready', db, error: null }));
    });
    load();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt > RECHECK_MS) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  return { ...state, retry: () => loadRef.current() };
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
