/** Read-only Activity data. Assist quotes are NOT merchant orders or payable invoices. */
const iso=v=>{if(!v)return null;if(typeof v.toDate==="function")return v.toDate().toISOString();const n=Date.parse(String(v));return Number.isFinite(n)?new Date(n).toISOString():null};
const text=v=>String(v||"").trim();
export function shoppingActivity(id,d={},now=Date.now()){
 const quote=d.finalQuote||{},due=Date.parse(quote.expiresAt);
 const active=d.state==="quote_offered"&&Number.isFinite(due)&&due>now;
 return {id:"assist-shopping:"+id,requestId:id,kind:"assist_shopping",service:"eat",
  title:text(d.storeName)||"Spotly Assist shopping",subtitle:text(d.customerMessage)||"Independent shopping price check",
  state:d.state||"pending_manual_quote",paymentStatus:"not_initiated",total:active&&Number.isFinite(quote.total)?quote.total:null,
  currency:quote.currency||d.estimate?.currency||"USD",createdAt:iso(d.createdAt),scheduledAt:null,
  primaryAction:active?"review_quote":null,attentionReason:active?"Review your quote":null,
  href:"/shop-for-me?store="+encodeURIComponent(text(d.storeId)),paymentEnabled:false,merchantOrder:false,dispatchEnabled:false};
}
export function bookingActivity(id,d={}){
 const state=d.state||"requested";
 return {id:"assist-booking:"+id,requestId:id,kind:"assist_booking",service:"book",
  title:text(d.businessName)||"Spotly Assist booking",subtitle:text(d.serviceName)||"Availability check",
  state,paymentStatus:"not_initiated",total:null,currency:null,createdAt:iso(d.createdAt),
  scheduledAt:iso(d.alternativeAt||d.requestedAt),primaryAction:state==="alternative_offered"?"review_alternative":null,
  attentionReason:state==="alternative_offered"?"Review a suggested time":null,
  href:"/assist/book?business="+encodeURIComponent(text(d.businessId)),paymentEnabled:false,merchantOrder:false,dispatchEnabled:false};
}
