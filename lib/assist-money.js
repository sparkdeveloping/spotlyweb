/** Independent Spotly shopping money rules. No merchant receivables, commissions or settlements. */
const fail=m=>{throw Object.assign(new Error(m),{status:409})};
export const cents=v=>{if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1000000||Math.abs(v*100-Math.round(v*100))>0.000001)fail("Invalid two-decimal money amount.");return Math.round(v*100)};
export function verifiedAssistQuote(request={},now=Date.now()){
 if(request.state!=="quote_accepted_awaiting_payment"||request.paymentStatus==="paid_held")fail("The quote is not awaiting payment.");
 const q=request.finalQuote;
 if(!q||q.currency!=="USD"||!q.verifiedBy||typeof q.note!=="string"||q.note.trim().length<12)fail("An independently verified USD quote is required.");
 const expiry=Date.parse(q.expiresAt);
 if(!Number.isFinite(expiry)||expiry<=now)fail("The quote has expired; request a new price confirmation.");
 const merchandise=cents(q.merchandiseTotal),shopping=cents(q.shoppingFee),delivery=cents(q.deliveryFee),total=cents(q.total);
 if(!merchandise||merchandise+shopping+delivery!==total)fail("The quote breakdown does not match its payable total.");
 return {currency:"USD",merchandise:merchandise/100,shopping:shopping/100,delivery:delivery/100,total:total/100,totalCents:total,expiresAt:q.expiresAt};
}
export function independentPaymentEnabled(settings={},store={}){
 return settings.assistFinance?.enabled===true&&settings.assistFinance?.providerReviewed===true&&
   settings.assistFinance?.driverDispatchEnabled===true&&
   settings.assistFinance?.manualFloatAttestationEnabled===true&&
   settings.independentShopping?.paymentCollectionEnabled===true&&store.financeReady===true;
}
