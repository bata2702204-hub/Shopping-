import { useEffect, useMemo, useState } from 'react';
import { priceService, computeBasket } from '../services/priceService.js';
import { CHAINS } from '../data/chains.js';

/** Fetch quotes for the list through the service layer and derive the basket comparison. */
export function usePrices(items) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refetch only when the identity of items changes (not on qty/checked changes).
  const signature = items.map((i) => `${i.id}:${i.productId}:${i.name}:${i.category}`).join('|');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    priceService
      .getQuotes(items)
      .then((q) => { if (alive) { setQuotes(q); setError(null); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const basket = useMemo(() => computeBasket(items, quotes, CHAINS), [items, quotes]);
  return { quotes, basket, loading, error, chains: CHAINS };
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
