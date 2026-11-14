// Catalog = all departments. Order here doesn't matter for search, but ids must be unique.
import produce from './produce.js';
import bakery from './bakery.js';
import meat from './meat.js';
import dairy from './dairy.js';
import pantry from './pantry.js';
import cleaning from './cleaning.js';
import frozen from './frozen.js';
import fitness from './more/fitness.js';
import moreProduce from './more/produce.js';
import moreBakery from './more/bakery.js';
import moreMeat from './more/meat.js';
import moreDairy from './more/dairy.js';
import morePantry from './more/pantry.js';
import moreCleaning from './more/cleaning.js';
import moreFrozen from './more/frozen.js';

export const PRODUCTS = [
  ...produce, ...moreProduce,
  ...bakery, ...moreBakery,
  ...meat, ...moreMeat,
  ...dairy, ...moreDairy, ...fitness,
  ...pantry, ...morePantry,
  ...cleaning, ...moreCleaning,
  ...frozen, ...moreFrozen,
];
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
