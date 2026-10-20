/** Customer-facing product names. Stable service IDs remain eat/shop/book/events/ride/send. */
export const SPOTLY_PRODUCTS=Object.freeze({
 eat:{id:"eat",name:"SpotlyBite",nav:"Bite",route:"/bite",legacy:"/eat",tagline:"Food, restaurants and takeaways"},
 shop:{id:"shop",name:"SpotlyShopper",nav:"Shopper",route:"/shopper",legacy:"/shop",tagline:"Stores, groceries and shopping help"},
 book:{id:"book",name:"SpotlyBook",nav:"Book",route:"/book",tagline:"Services, appointments and stays"},
 events:{id:"events",name:"SpotlyLive",nav:"Live",route:"/live",legacy:"/events",tagline:"Events, experiences and tickets"},
 ride:{id:"ride",name:"SpotlyRide",nav:"Ride",route:"/ride",tagline:"Get there with Spotly"},
 send:{id:"send",name:"SpotlySend",nav:"Send",route:"/send",tagline:"Send parcels locally"}
});
export const PRODUCT_ROUTES=Object.freeze(Object.fromEntries(Object.entries(SPOTLY_PRODUCTS).map(([id,p])=>[id,p.route])));
export function publicProductRoute(id){return PRODUCT_ROUTES[id]||"/";}
export function productServiceId(route){
 const path=String(route||"").replace(/\/+$/,"").toLowerCase();
 return Object.values(SPOTLY_PRODUCTS).find(p=>p.route===path||p.legacy===path)?.id||null;
}
