// Catalog = all departments. Order here doesn't matter for search, but ids must be unique.
import produce from './produce.js';
import bakery from './bakery.js';
import meat from './meat.js';
import dairy from './dairy.js';
import pantry from './pantry.js';
import cleaning from './cleaning.js';
import frozen from './frozen.js';

export const PRODUCTS = [...produce, ...bakery, ...meat, ...dairy, ...pantry, ...cleaning, ...frozen];
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
