import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Apple, Beef, Check, Croissant, Milk, Minus, Package, Plus, Snowflake, SprayCan, Wheat, X } from 'lucide-react';
import { getCategory } from '../data/categories.js';
import { fmt, fmtQty } from '../utils/format.js';

const ICONS = { Apple, Beef, Croissant, Milk, Package, Snowflake, SprayCan, Wheat };

export function CategoryIcon({ id, className = 'h-4 w-4' }) {
  const Icon = ICONS[getCategory(id).icon] || Package;
  return <Icon className={className} aria-hidden="true" />;
}

export function CategoryBadge({ id, className = '' }) {
  const c = getCategory(id);
  return (
    <span className={`chip ${c.badge} ${className}`}>
      <CategoryIcon id={id} className="h-3 w-3" />
      {c.name}
    </span>
  );
}

/** Shekel amount, isolated LTR so "₪340.00" never gets flipped inside RTL text. */
export function Price({ value, className = '' }) {
  return (
    <span dir="ltr" className={`tabular-nums ${className}`} style={{ unicodeBidi: 'isolate' }}>
      ₪{fmt(value)}
    </span>
  );
}

export function Checkbox({ checked, onChange, size = 'md', label }) {
  const dim = size === 'lg' ? 'h-8 w-8 rounded-xl' : 'h-6 w-6 rounded-lg';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`${dim} grid shrink-0 place-items-center border-2 transition-all duration-200 active:scale-90 ${
        checked
          ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
          : 'border-slate-300 bg-white hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-900'
      }`}
    >
      {checked && <Check className={`${size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} animate-pop`} strokeWidth={3} />}
    </button>
  );
}

export function Stepper({ value, onChange, min = 1, step = 1 }) {
  const set = (v) => onChange(Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="flex items-center rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800" dir="ltr">
      <button type="button" aria-label="הפחת כמות" onClick={() => set(value - step)} disabled={value <= min}
        className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 transition hover:bg-white active:scale-90 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums">{fmtQty(value)}</span>
      <button type="button" aria-label="הוסף כמות" onClick={() => set(value + step)}
        className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 transition hover:bg-white active:scale-90 dark:text-slate-300 dark:hover:bg-slate-700">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Bottom sheet modal (mobile-style). */
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  // Portal: animated ancestors create stacking contexts that would trap a fixed overlay under the nav.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe shadow-2xl animate-fade-up dark:bg-slate-900 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="סגור"><X className="h-5 w-5" /></button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center animate-fade-up">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700',
    soft: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[.97] disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
