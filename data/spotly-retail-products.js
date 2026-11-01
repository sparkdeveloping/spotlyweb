import catalogues from "./spotly-specific-catalogues.js";
import { businessPhotoFamily } from "../lib/business-photography.js";

export const SPOTLY_RETAIL_PRODUCTS = catalogues.products;
export const SPOTLY_CATALOGUE_VERSION = catalogues.version;
const TYPES = {
  supermarket: /.*/, "general-retail": /.*/, "shopping-centre": /.*/,
  convenience: /bakery|milk|dairy|rice|grain|oil|sugar|spread|tea|drink|biscuit|cleaning|oral|soap|toilet|produce|egg/i,
  "fresh-produce": /produce|vegetable|fruit/i, "market-stalls": /produce|vegetable|fruit/i,
  butchery: /meat|poultry|butcher/i, bakery: /bakery/i, beverages: /drink|tea/i,
  pharmacy: /oral|hair care|bath soap|baby/i, "beauty-products": /oral|hair care|bath soap/i,
  "baby-goods": /baby/i, stationery: /stationery/i, bookshop: /stationery/i,
  hardware: /hardware|electrical/i, electronics: /hardware|electrical/i, homeware: /homeware/i,
  "pet-supplies": /pet care/i, confectionery: /biscuit/i
};
function matchingRetailer(record) {
  const name = [record.name,record.brandName].join(" ").toLowerCase();
  if (/\b(?:pick\s*(?:n|and)?\s*pay|pnp|tm)\b/.test(name)) return /TM Pick n Pay/i;
  if (/\bspar\b/.test(name)) return /SPAR Zimbabwe/i;
  if (/\bok\b/.test(name) && !/\bokmart\b/.test(name)) return /OK Zimbabwe online shop/i;
  return null;
}
export function retailItemsForBusiness(record = {}) {
  if ((record.country || "ZW") !== "ZW") return [];
  const categories = TYPES[businessPhotoFamily(record)];
  if (!categories) return [];
  const retailer = matchingRetailer(record);
  return SPOTLY_RETAIL_PRODUCTS.filter(item => categories.test(item.category)).map(item => ({...item,reference:retailer ? item.references.find(reference=>retailer.test(reference.label)) || item.reference : item.reference}))
    .sort((a,b)=>Number(Boolean(retailer?.test(b.reference.label)))-Number(Boolean(retailer?.test(a.reference.label))));
}
export function retailCatalogueScope(record = {}, items = []) {
  const retailer = matchingRetailer(record);
  return retailer && items.length && items.every(item=>retailer.test(item.reference.label)) ? "retailer" : "product_library";
}
