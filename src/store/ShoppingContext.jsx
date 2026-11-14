import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { categorize } from '../services/categorizer.js';
import { upsertCustomProduct } from '../services/customProducts.js';
import { normalize } from '../services/hebrew.js';
import { uid } from '../utils/format.js';

const STORAGE_KEY = 'smart-shopping:state:v1';

const initialState = { items: [], selectedChain: null };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return { ...initialState, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return initialState;
  }
}

/**
 * Resolve free text to { category, product }. Unknown names become a custom product
 * (keyword-detected department + estimated department price), so every item can be priced.
 */
export function resolveProduct(name, categoryOverride) {
  const { category: detected, product } = categorize(name);
  const category = categoryOverride || detected;
  if (product && !product.custom) return { category, product };
  return { category, product: upsertCustomProduct(name, category) };
}

/** Build an item from free text: auto-categorized and always linked to a product. */
export function makeItem(name, qty = 1) {
  const { category, product } = resolveProduct(name);
  return { id: uid(), name: name.trim(), qty, category, productId: product.id, checked: false, addedAt: Date.now() };
}

const sameItem = (a, b) =>
  (a.productId && a.productId === b.productId) || normalize(a.name) === normalize(b.name);

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      const items = [...state.items];
      for (const incoming of action.items) {
        const i = items.findIndex((x) => !x.checked && sameItem(x, incoming));
        if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + incoming.qty };
        else items.unshift(incoming);
      }
      return { ...state, items };
    }
    case 'update':
      return { ...state, items: state.items.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)) };
    case 'toggle':
      return { ...state, items: state.items.map((x) => (x.id === action.id ? { ...x, checked: !x.checked } : x)) };
    case 'remove':
      return { ...state, items: state.items.filter((x) => x.id !== action.id) };
    case 'restore': {
      const items = [...state.items];
      items.splice(Math.min(action.index, items.length), 0, action.item);
      return { ...state, items };
    }
    case 'clearChecked':
      return { ...state, items: state.items.filter((x) => !x.checked) };
    case 'uncheckAll':
      return { ...state, items: state.items.map((x) => ({ ...x, checked: false })) };
    case 'replaceAll':
      return { ...state, items: action.items };
    case 'selectChain':
      return { ...state, selectedChain: action.chainId };
    default:
      return state;
  }
}

const Ctx = createContext(null);

export function ShoppingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode etc. */ }
  }, [state]);

  const addMany = useCallback((entries) => {
    const items = entries.map(({ name, qty }) => makeItem(name, qty));
    dispatch({ type: 'add', items });
    return items;
  }, []);

  const api = useMemo(() => ({
    ...state,
    addMany,
    update: (id, patch) => dispatch({ type: 'update', id, patch }),
    toggle: (id) => dispatch({ type: 'toggle', id }),
    remove: (id) => {
      const index = state.items.findIndex((x) => x.id === id);
      const item = state.items[index];
      dispatch({ type: 'remove', id });
      return () => dispatch({ type: 'restore', item, index });
    },
    clearChecked: () => {
      const prev = state.items;
      dispatch({ type: 'clearChecked' });
      return () => dispatch({ type: 'replaceAll', items: prev });
    },
    clearAll: () => {
      const prev = state.items;
      dispatch({ type: 'replaceAll', items: [] });
      return () => dispatch({ type: 'replaceAll', items: prev });
    },
    uncheckAll: () => dispatch({ type: 'uncheckAll' }),
    selectChain: (chainId) => dispatch({ type: 'selectChain', chainId }),
  }), [state, addMany]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useShopping() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShopping must be used inside <ShoppingProvider>');
  return v;
}

export const SAMPLE_LIST = [
  ['חלב', 2], ['ביצים', 1], ['קוטג׳', 2], ['עגבניות', 1], ['מלפפונים', 1], ['בננות', 1],
  ['לחם', 1], ['חזה עוף', 1], ['אורז', 1], ['טחינה', 1], ['חומר כביסה', 1], ['נייר טואלט', 1], ['גלידה', 1],
].map(([name, qty]) => ({ name, qty }));
