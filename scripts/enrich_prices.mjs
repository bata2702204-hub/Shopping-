#!/usr/bin/env node
// Adds a department (and the matching dictionary entry) to every REAL product in
// public/real_prices.json, using the app's own categorizer so the rules live in one place.
// Run after scripts/fetch_real_prices.py. Prices and product data are not touched.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { categorize } from '../src/services/categorizer.js';
import { buildFreshGroups } from './fresh_matching.mjs';

const file = fileURLToPath(new URL('../public/real_prices.json', import.meta.url));
const data = JSON.parse(readFileSync(file, 'utf8'));
const base = ['barcode', 'name', 'manufacturer', 'unit', 'weighted', 'prices'];
const t0 = Date.now();
const counts = {};

data.products = data.products.map((row) => {
  const r = row.slice(0, base.length);
  const { category, product } = categorize(r[1]);
  counts[category] = (counts[category] || 0) + 1;
  return [...r, category, product?.id || null];
});
data.fields = [...base, 'category', 'dictId'];

// Fresh produce/meat: group the plain per-kg item of every chain by name (see fresh_matching.mjs).
data.freshGroups = buildFreshGroups(data.products, data.chainOrder);

writeFileSync(file, JSON.stringify(data));
console.log(`enriched ${data.products.length} products in ${Date.now() - t0}ms`, counts);
console.log(`fresh groups: ${data.freshGroups.length}`);
