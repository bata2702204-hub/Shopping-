export const fmt = (n) =>
  (Number(n) || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtQty = (q) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

/** "חלב, ביצים, 2 עגבניות\nלחם" → ["חלב","ביצים","עגבניות","לחם"]; supports "3 עגבניות" / "עגבניות x3". */
export function parseQuickAdd(text) {
  return String(text)
    .split(/[,\n،;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      let qty = 1;
      let name = s;
      const lead = name.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)?\s+(.+)$/i);
      const trail = name.match(/^(.+?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)$/i);
      if (lead) { qty = Number(lead[1]); name = lead[2]; } else if (trail) { name = trail[1]; qty = Number(trail[2]); }
      return { name: name.trim(), qty: qty > 0 ? qty : 1 };
    })
    .filter((x) => x.name);
}
