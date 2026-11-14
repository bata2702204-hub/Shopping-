import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { categorize } from '../services/categorizer.js';
import { normalize } from '../services/hebrew.js';
import { uid } from '../utils/format.js';

const STORAGE_KEY = 'smart-shopping:state:v1';

// Items saved before real data had links to mock products (productId); those are dropped.
const migrate = (items) => items.map(({ productId, ...it }) => ({ barcode: null, ...it }));

const initialState = { items: [], selectedChain: null };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return { ...initialState, ...parsed, items: Array.isArray(parsed.items) ? migrate(parsed.items) : [] };
  } catch {
    return initialState;
  }
}

/**
 * Build a list item. With a real product (from real_prices.json) it is linked by barcode and gets
 * real prices; free text without a real product is kept unlinked (no price) until one is chosen.
 */
export function makeItem({ name, qty = 1, product = null }) {
  if (product) {
    return { id: uid(), name: product.name, qty, category: product.category, barcode: product.barcode, checked: false, addedAt: Date.now() };
  }
  return { id: uid(), name: name.trim(), qty, category: categorize(name).category, barcode: null, checked: false, addedAt: Date.now() };
}

const sameItem = (a, b) =>
  (a.barcode ? a.barcode === b.barcode : !b.barcode && normalize(a.name) === normalize(b.name));

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
    const items = entries.map(makeItem);
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

// Example list: each term is resolved to the top real product found by search when loaded.
export const SAMPLE_TERMS = [
  ['חלב 3%', 2], ['ביצים', 1], ['קוטג', 2], ['עגבניה', 1], ['מלפפון', 1], ['בננה', 1],
  ['לחם אחיד', 1], ['חזה עוף', 1], ['אורז פרסי', 1], ['טחינה', 1], ['אבקת כביסה', 1], ['נייר טואלט 32', 1], ['במבה 80 גרם', 1],
];
