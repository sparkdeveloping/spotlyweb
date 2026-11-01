import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import catalogues from "../data/spotly-specific-catalogues.js";
import exclusions from "../data/catalogue-media-review.js";
import places from "../lib/generated/open-marketplace-places.js";
import { menuItemsForBusiness } from "../data/spotly-restaurant-menus.js";
import { retailItemsForBusiness } from "../data/spotly-retail-products.js";
import { businessPhotoFamily } from "../lib/business-photography.js";
import { groupMarketplaceBusinesses } from "../lib/business-groups.js";
import { directoryIntakeStore, refreshDirectoryCatalogue } from "../lib/spotly-catalogue.js";
import { independentPublicStore, independentQuote } from "../lib/independent-shopping.js";
import { routeHarness } from "./helpers/route-harness.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const bon=places.records.find(item=>item.id==="osm-node-1574307183");

test("published catalogues contain specific sourced identities and no imported payable prices",()=>{
  assert.ok(catalogues.menus.length>=15);
  assert.ok(catalogues.menus.flatMap(menu=>menu.items).length>600);
  assert.ok(catalogues.products.length>100);
  for(const items of [...catalogues.menus.map(menu=>menu.items),catalogues.products]){
    assert.equal(new Set(items.map(item=>item.id)).size,items.length);
    for(const item of items){
      assert.match(item.id,/^[a-zA-Z0-9_-]{2,80}$/);
      assert.ok(item.name.length>2&&item.name.length<=160,item.name);
      assert.doesNotMatch(item.name,/^(Bread|Milk|Meal request|Item enquiry|Everyday supplies)$/);
      assert.match(item.reference.url,/^https:\/\//);assert.match(item.reference.observedAt,/^2026-11-01/);
      assert.equal(item.priceEstimate,null);assert.equal(item.priceCheckedAt,null);assert.equal(item.status,"requestable");
    }
  }
  const items=independentPublicStore("directory_"+bon.id,directoryIntakeStore(bon.id,bon)).items;
  assert.ok(items.some(item=>/Lobels Prime White Bread/.test(item.name)));
  assert.ok(items.some(item=>/Red Seal Roller Meal 10Kg/.test(item.name)));
  assert.ok(items.some(item=>/Raha Cooking Oil 2L/.test(item.name)));
  assert.ok(items.every(item=>item.availability==="to_confirm"&&item.priceEstimate===null));
  assert.doesNotMatch(JSON.stringify(items),/sourceListedPrice|historicalPrice|sourceSalePrice|branchStockConfirmed|imageLocalPath/);
});

test("all actual Chicken Inn locations keep chicken imagery despite conflicting imported tags",()=>{
  const singles=places.records.filter(item=>/^chicken inn(?: msasa| drive through)?$/i.test(item.name));
  assert.ok(singles.length>20);
  for(const item of singles){assert.equal(businessPhotoFamily(item),"fried-chicken",item.id);assert.ok(menuItemsForBusiness(item).some(dish=>dish.name==="2 Piecer"),item.id);}
  const mistaken={name:"Chicken Inn",brandName:"Simbisa",city:"Harare",photoFamily:"pizza",sourceTags:{amenity:"cafe",cuisine:"pizza;burger"}};
  assert.equal(businessPhotoFamily(mistaken),"fried-chicken");
  assert.ok(menuItemsForBusiness(mistaken).every(item=>!/(Hawaiian|Regina) Pizza/.test(item.name)));
  assert.equal(businessPhotoFamily({name:"Chicken Inn, Steers",sourceTags:{amenity:"fast_food"}}),"takeaway");
  assert.equal(businessPhotoFamily({name:"Pizza Pharmacy",sourceTags:{amenity:"pharmacy"}}),"pharmacy");
});

test("parent-company tags do not split restaurant chains or merge different brands",()=>{
  const branches=places.records.filter(item=>item.city==="Harare"&&/^chicken inn(?: msasa| drive through)?$/i.test(item.name));
  const grouped=groupMarketplaceBusinesses(branches);
  assert.equal(grouped.length,1);assert.equal(grouped[0].name,"Chicken Inn");
  const cross=groupMarketplaceBusinesses([{...bon,id:"chicken",name:"Chicken Inn",brandName:"Simbisa"},{...bon,id:"pizza",name:"Pizza Inn",brandName:"Simbisa"}]);
  assert.equal(cross.length,2);
});

test("branch-specific menus stay with their actual location and country",()=>{
  const avondale=menuItemsForBusiness({name:"Cafe Nush",city:"Harare",area:"Avondale"});
  const highlands=menuItemsForBusiness({name:"Café Nush",city:"Harare",area:"Highlands"});
  assert.ok(avondale.length>30&&highlands.length>40);
  assert.ok(avondale.every(item=>item.locationScope==="Avondale"));
  assert.ok(highlands.every(item=>item.locationScope==="Highland Park"));
  assert.deepEqual(menuItemsForBusiness({name:"Cafe Nush",city:"Harare",area:"Unconfirmed suburb"}),[]);
  assert.deepEqual(menuItemsForBusiness({name:"KFC",city:"Blantyre",country:"MW"}),[]);
  const pomona=menuItemsForBusiness({name:"Chop Chop",city:"Harare",area:"Pomona"});
  assert.ok(pomona.length);assert.ok(pomona.every(item=>item.locationScope==="Pomona"));
  const doppio=menuItemsForBusiness({name:"Doppio Zero Harare",city:"Harare"});
  assert.ok(doppio.length>70);assert.ok(doppio.every(item=>/DZ_Zim_/.test(item.reference.url)));
});

test("retail references keep exact categories and source evidence without claiming another chain's stock",()=>{
  const spar=retailItemsForBusiness({...bon,name:"SPAR"});
  const raha=spar.find(item=>item.name==="Raha Cooking Oil 2L");
  assert.match(raha.reference.label,/SPAR/);
  assert.equal(spar.filter(item=>item.name==="Raha Cooking Oil 2L").length,1);
  const fruit=retailItemsForBusiness({...bon,name:"Local produce",sourceTags:{shop:"greengrocer"}});
  assert.ok(fruit.length>=5);assert.ok(fruit.every(item=>item.category==="Fresh Produce"));
  const meat=retailItemsForBusiness({...bon,name:"Local butcher",sourceTags:{shop:"butcher"}});
  assert.ok(meat.some(item=>/Irvines.*1Kg/i.test(item.name)));assert.ok(meat.every(item=>/meat|poultry/i.test(item.category)));
  assert.deepEqual(retailItemsForBusiness({...bon,name:"Clothing boutique",sourceTags:{shop:"clothes"}}),[]);
  assert.equal(directoryIntakeStore(bon.id,bon).catalogueScope,"product_library");
});

test("published choices are preserved in the order and forged options are rejected",()=>{
  const raw=directoryIntakeStore("roco",{...bon,name:"RocoMamas",sourceTags:{amenity:"restaurant"},businessType:"restaurant_food"});
  const store=independentPublicStore(raw.id,raw),wings=store.items.find(item=>item.name==="Wings");
  const choices=[{group:"Portion / option",value:"12 wings"},{group:"flavour",value:"Sticky BBQ"}];
  const quote=independentQuote(store,[{itemId:wings.id,quantity:2,choices}]);
  assert.deepEqual(quote.items[0].choices,choices);assert.match(quote.items[0].name,/12 wings.*Sticky BBQ/);assert.equal(quote.totalEstimate,null);assert.equal(quote.paymentRequired,false);
  assert.throws(()=>independentQuote(store,[{itemId:wings.id,quantity:1,choices:[{group:"flavour",value:"Made-up flavour"}]}]));
  assert.throws(()=>independentQuote(store,[{itemId:wings.id,quantity:1,choices:[choices[0],choices[0]]}]));
});

test("unpublished menus still accept exact custom orders without invented dishes",async()=>{
  const h=routeHarness(root);h.records.set("platformSettings/global",{verification:{publishUnclaimed:true}});
  const unknown={...bon,id:"unknown-restaurant",name:"Unpublished Local Kitchen",businessType:"restaurant_food",sourceTags:{amenity:"restaurant"}};
  h.records.set("businesses/unknown-restaurant",unknown);
  const raw=directoryIntakeStore(unknown.id,unknown),store=independentPublicStore(raw.id,raw);
  assert.deepEqual(store.items,[]);assert.equal(store.allowCustomItems,true);
  const intake=h.load("app/api/customer/independent-shopping/requests/route.js");
  const response=await intake.POST(h.request({requestId:"custom_catalogue_123",storeId:store.id,items:[],customItems:[{name:"Exact dish and portion requested by customer",quantity:2}],contactName:"Test Customer",contactPhone:"+263770000000",deliveryAddress:"Test customer delivery street, Harare"}));
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const result=await response.json();
  assert.equal(result.estimate.totalEstimate,null);assert.equal(h.records.get("independentShoppingRequests/"+result.id).items[0].quantity,2);
  assert.equal([...h.records.keys()].some(key=>key.startsWith("orders/")||key.startsWith("deliveryJobs/")),false);
});

test("old automatic catalogues refresh while operational controls and manual catalogues remain intact",async()=>{
  const seed=directoryIntakeStore(bon.id,bon),old={...seed,catalogueOrigin:undefined,catalogueVersion:"",items:[{id:"request_supermarket_1",name:"Bread",catalogueKind:"request_suggestion",status:"requestable",priceEstimate:null}],operationalReviewed:true,financeReady:true,address:"Reviewed collection address"};
  const next=refreshDirectoryCatalogue(old,seed);assert.ok(next.items.some(item=>/Lobels/.test(item.name)));assert.equal(next.operationalReviewed,true);assert.equal(next.financeReady,true);assert.equal(next.address,old.address);
  const manual={...old,catalogueOrigin:"operator",items:[{id:"confirmed-item",name:"Manually confirmed exact product",status:"requestable"}]};
  assert.equal(refreshDirectoryCatalogue(manual,seed),manual);
  const h=routeHarness(root);h.records.set("platformSettings/global",{verification:{publishUnclaimed:true}});h.records.set("independentShoppingStores/"+seed.id,old);
  const {directoryShoppingStore}=h.load("lib/directory-shopping-server.js");
  assert.ok((await directoryShoppingStore(h.db,{businessId:bon.id})).store.items.some(item=>/Lobels/.test(item.name)));
  h.records.get("independentShoppingStores/"+seed.id).assistAccepting=false;
  assert.equal(await directoryShoppingStore(h.db,{businessId:bon.id}),null);
});

test("only shipped, usable item photos are exposed, with reviewed mismatches excluded",async()=>{
  const items=catalogues.menus.flatMap(menu=>menu.items).concat(catalogues.products);
  for(const item of items)if(exclusions[item.id])assert.equal(item.image,"",item.id);
  const images=[...new Set(items.map(item=>item.image).filter(Boolean))];assert.ok(images.length>250);
  let bytes=0;
  for(const src of images){assert.match(src,/^\/marketplace\/items\/[a-z0-9_-]+\.webp$/);const data=await readFile(root+"public"+src),meta=await sharp(data).metadata();assert.equal(meta.format,"webp");assert.ok(Math.max(meta.width,meta.height)>=180,src);assert.ok(data.length<140000,src);bytes+=data.length;}
  assert.ok(bytes<9*1024*1024);
  const raw=directoryIntakeStore(bon.id,bon);raw.items=[{...raw.items[0],image:"https://unreviewed.example/photo.jpg",reference:{label:"Bad",url:"javascript:alert(1)"}}];
  const exposed=independentPublicStore(raw.id,raw).items[0];assert.equal(exposed.image,"");assert.equal(exposed.reference,null);
});
