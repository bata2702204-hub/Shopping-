// Supermarket departments. `aisle` = the typical walking order in an Israeli supermarket,
// used to sort Shopping Mode. Class strings are written out in full so Tailwind keeps them.
export const CATEGORIES = [
  { id: 'produce', name: 'ירקות ופירות', icon: 'Apple', aisle: 1,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { id: 'bakery', name: 'מאפים ולחמים', icon: 'Croissant', aisle: 2,
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    dot: 'bg-orange-500', soft: 'bg-orange-50 dark:bg-orange-500/10' },
  { id: 'meat', name: 'בשר ודגים', icon: 'Beef', aisle: 3,
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    dot: 'bg-rose-500', soft: 'bg-rose-50 dark:bg-rose-500/10' },
  { id: 'dairy', name: 'מוצרי חלב', icon: 'Milk', aisle: 4,
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    dot: 'bg-sky-500', soft: 'bg-sky-50 dark:bg-sky-500/10' },
  { id: 'pantry', name: 'יבשים ומזווה', icon: 'Wheat', aisle: 5,
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    dot: 'bg-amber-500', soft: 'bg-amber-50 dark:bg-amber-500/10' },
  { id: 'cleaning', name: 'ניקיון ותחזוקה', icon: 'SprayCan', aisle: 6,
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    dot: 'bg-violet-500', soft: 'bg-violet-50 dark:bg-violet-500/10' },
  { id: 'frozen', name: 'קפואים', icon: 'Snowflake', aisle: 7,
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    dot: 'bg-cyan-500', soft: 'bg-cyan-50 dark:bg-cyan-500/10' },
  { id: 'other', name: 'אחר', icon: 'Package', aisle: 8,
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    dot: 'bg-slate-400', soft: 'bg-slate-50 dark:bg-slate-500/10' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const getCategory = (id) => CATEGORY_BY_ID[id] || CATEGORY_BY_ID.other;
