// Mock product catalog with realistic Israeli shelf prices (₪, approximate).
// The rows live per department in ./catalog/; prices for chains not written explicitly are
// generated from the Shufersal price and each chain's price level (see catalog/define.js).
// A real provider (see services/priceService.js) would return the same price-map shape.
export { PRODUCTS, PRODUCT_BY_ID } from './catalog/index.js';
