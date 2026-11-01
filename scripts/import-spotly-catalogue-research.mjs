// Import reviewed factual research, never retailer stock or payable prices.
// node scripts/import-spotly-catalogue-research.mjs /absolute/research-directory
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import exclusions from "../data/catalogue-media-review.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const input = process.argv[2];
if (!input || !path.isAbsolute(input)) throw new Error("Supply the absolute directory containing reviewed research JSON.");
const read = name => readFile(path.join(input, name), "utf8").then(JSON.parse);
const [inn, restaurants, retail] = await Promise.all([read("innscor-menu-research.json"), read("restaurant-menus-research.json"), read("retail-products-research.json")]);
const slug = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = value => slug(value).replace(/-/g, "");
const title = value => value === value.toUpperCase() ? value.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bKfc\b/g, "KFC").replace(/\bBbq\b/g, "BBQ") : value;
const id = value => value.length <= 78 ? value : `${value.slice(0,65)}-${createHash("sha1").update(value).digest("hex").slice(0,10)}`;
const media = [];
async function photo(key, url, localPath, reference, kind, verified = true) {
  if (!url || !verified || exclusions[key]) return "";
  const filename = `${id(slug(key))}.webp`, src = `/marketplace/items/${filename}`;
  media.push({ id:key, path:src, url, localPath:localPath || null, source:reference, kind, rights:"source_product_reference", observedAt:"2026-11-01" });
  try { await access(path.join(root, "public", src)); return src; } catch { return ""; }
}
function options(item) {
  const groups = Object.entries(item.options || {}).filter(([,values]) => Array.isArray(values)).map(([group,values])=>({ group, values:values.filter(value=>typeof value === "string") }));
  const variants = (item.variants || []).map(variant => variant.label || Object.entries(variant).filter(([key,value]) => !/price|currency/i.test(key) && typeof value === "string").map(([,value])=>value).join(" · ")).filter(Boolean);
  if (variants.length > 1) groups.unshift({ group:"Portion / option", values:[...new Set(variants)] });
  return groups.filter(group => group.values.length).slice(0,6);
}
async function menuItem(item, brand, key, modifiers = []) {
  const offer = (item.offers || []).find(offer=>offer.channel === "pickup") || item.offers?.[0];
  const reference = {label:brand.replace(/ Zimbabwe$/, ""),url:offer?.sourceUrl || item.sourceUrl,observedAt:item.observedAt || item.observedOn || "2026-11-01"};
  const variants = (item.variants || []).map(v=>v.label).filter(Boolean);
  const portion = item.portion || (variants.length === 1 ? variants[0] : "");
  const detail = offer?.portion || {};
  const counts = [["chickenPieces","chicken pieces"],["winglets","winglets"],["chickenFillets","chicken fillets"],["chickenStrips","chicken strips"],["nuggets","nuggets"],["largeChips","large chips"]].filter(([field])=>detail[field]).map(([field,label])=>`${detail[field]} ${label}`);
  const description = portion || [detail.recipe,...counts,...(detail.includes || []).map(value=>value === "chips" && detail.chipsSize ? `${detail.chipsSize} chips` : value),detail.format,detail.sideSelections ? `Choose ${detail.sideSelections} sides; add your choices in instructions` : ""].filter(Boolean).join(" · ");
  let name = title(item.name).replace(/\s+/g," ").trim();
  if(key==="kfc") name=name.replace(/\bSw\b|\bSW\b/g,"Streetwise").replace(/Bucket 4 1/g,"Bucket for One").replace("Box Clever Lunch Box - Lunch Box - ","Box Clever Lunch Box - ").replace("Box Clever Lunch Box - Dunked Box Clever Box Meal","Box Clever Dunked Box Meal");
  if (key === "pizza-inn" && item.category === "Pizza" && !/pizza/i.test(name)) name += " Pizza";
  if (["bakers-inn","creamy-inn"].includes(key)) name = `${brand} ${name}`;
  const itemOptions = options(item);
  if (modifiers.length) {
    const allowed = new Set((item.offers || []).flatMap(offer=>offer.modifierGroupIds || []));
    for (const group of modifiers.filter(group=>allowed.has(group.id) && group.maxSelections === 1)) {
      const values = group.options.filter(option=>option.name && !option.requiresLabelVerification).map(option=>title(option.name));
      if (values.length && itemOptions.length < 6) itemOptions.push({group:title(group.name), values:[...new Set(values)].slice(0,30)});
    }
  }
  const itemId = id(`menu_${key}_${slug(item.id)}`);
  return {id:itemId,name,category:title(item.category || "Menu").replace(/\s*-\s*$/, ""),unit:portion || counts[0] || "",description,options:itemOptions,status:"requestable",catalogueKind:"menu_reference",priceEstimate:null,priceCheckedAt:null,reference,locationScope:item.locationScope || "",image:await photo(itemId,offer?.imageUrl || item.imageUrl,null,reference,"dish"),imageKind:"dish"};
}
const menus = [];
for (const brand of inn.brands) {
  // Family-level products remain branded references. Pack-labelled bakery
  // products below replace these broad bread names at the point of selection.
  menus.push({key:brand.brandId,name:brand.name.replace(/ Zimbabwe$/, ""),country:"ZW",city:"",items:await Promise.all(brand.items.map(item=>menuItem(item,brand.name.replace(/ Zimbabwe$/, ""),brand.brandId,brand.modifierGroups || [])))});
}
for (const brand of restaurants.restaurants) {
  const key = slug(brand.brand).replace("roco-mamas","rocomamas");
  menus.push({key,name:brand.brand,country:"ZW",city:["cafe-nush","chop-chop","amanzi","sabai-thai","doppio-zero"].includes(key)?"Harare":"",items:await Promise.all(brand.items.map(item=>menuItem(item,brand.brand,key)))});
}
const manualAliases = new Map([
  ["Mahatma Rice 2kg","Mahatma White Rice 2Kg"], ["Lobels Lemon Creams 150g","Lobels Biscuits Lemon Cream 150G"],
  ["Tanganda Tagless Tea Bags 100s","Tanganda Tea Bags 100'S Tagless"], ["Baker's Inn Whole Wheat Loaf","Bakers Inn Wholewheat Bread"],
  ["Dendairy Maas 500ml","Dendairy Maas 500Ml Milk."]
].map(([a,b])=>[norm(a),norm(b)]));
const products = [], lookup = new Map();
const productRows = [...retail.products, ...retail.indexedProducts.filter(item=>!["indexed-35","indexed-41"].includes(item.id))];
try { const extra=await read("retail-products-extra.json"); productRows.push(...(extra.products || [])); } catch(error) { if(error.code!=="ENOENT")throw error; }
for (const item of productRows) {
  const canonical = manualAliases.get(norm(item.name)) || norm(item.name);
  const reference = {label:item.sourceRetailer,url:item.sourceUrl,observedAt:item.observedAt || "2026-11-01",observationType:item.observationType};
  const existing = lookup.get(canonical);
  if (existing) {
    if(!existing.references.some(ref=>ref.url===reference.url))existing.references.push(reference);
    existing.retailers=[...new Set([...existing.retailers,...(item.retailerApplicability || [])])];
    if (item.observationType === "live_public_storefront_api" && existing.sourceObservation !== "live_public_storefront_api") {
      Object.assign(existing,{id:id(`product_${item.id}`),name:item.name,brand:item.brand || existing.brand,packSize:item.packLabel || existing.packSize,unit:item.unit || item.packLabel || existing.unit,reference,sourceObservation:item.observationType,image:await photo(`product_${item.id}`,item.imageUrl,item.imageLocalPath,reference,"product",item.imageVerifiedAgainstExactPackage===true)});
    }
    continue;
  }
  const product = {id:id(`product_${item.id}`),name:item.name,brand:item.brand || "",packSize:item.packLabel || "",unit:item.unit || item.packLabel || "",category:item.category,description:"",status:"requestable",catalogueKind:"product_reference",priceEstimate:null,priceCheckedAt:null,reference,references:[reference],retailers:item.retailerApplicability || [],image:await photo(`product_${item.id}`,item.imageUrl,item.imageLocalPath,reference,"product",item.imageVerifiedAgainstExactPackage===true),imageKind:"product",sourceObservation:item.observationType};
  products.push(product);lookup.set(canonical,product);
}
// Prefer exact named, photographed loaves for this bakery brand. Other
// supported brand-owner products are retained without fabricated pack sizes.
const bakery = menus.find(menu=>menu.key==="bakers-inn");
if (bakery) {
  const loaves = products.filter(product=>norm(product.brand || product.name).startsWith("bakersinn") && product.category === "Bakery");
  bakery.items = [...loaves.map(product=>({...product,catalogueKind:"menu_reference"})),...bakery.items.filter(item=>!/^Baker.s Inn (?:White bread|Brown bread|Whole wheat bread|Seed bread|Low GI bread)$/i.test(item.name))];
}
for (const menu of menus) {
  const seen=new Set(); menu.items=menu.items.filter(item=>{const k=norm(item.name+item.locationScope+item.unit);if(seen.has(k))return false;seen.add(k);return true;});
}
const data = {version:"2026-11-specific-v1",observedAt:"2026-11-01",notice:"Published menu and product identities. No branch stock or payable prices are imported.",menus,products};
await writeFile(path.join(root,"data/spotly-specific-catalogues.js"), `// Reviewed source identities; source observations are never payable quotes.\nexport default ${JSON.stringify(data,null,2)};\n`);
await writeFile(path.join(root,"data/spotly-item-photo-sources.js"), `// Item-specific source photography, kept separate from branch/header imagery.\nexport default ${JSON.stringify(media.map(({localPath,...item})=>item),null,2)};\n`);
await writeFile(path.join(input,"catalogue-photo-downloads.json"),JSON.stringify(media,null,2));
console.log(JSON.stringify({menus:menus.length,menuItems:menus.reduce((n,menu)=>n+menu.items.length,0),products:products.length,photoCandidates:media.length,photosPublished:menus.flatMap(menu=>menu.items).concat(products).filter(item=>item.image).length}));
