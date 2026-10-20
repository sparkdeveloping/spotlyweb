import {refundCents,refundSummary} from "./assist-refunds.js";
const fail=m=>{throw Object.assign(new Error(m),{status:409})};
export function independentFinanceClosure(request={},job={},float={},refunds=[]){
 if(request.model!=="independent_shopping"||request.state!=="delivered"||
    request.paymentStatus!=="paid_held"||job.state!=="delivered"||
    job.receiptReviewedAt==null||job.reviewedBy==null)
   fail("An independently funded, delivered and reviewed purchase is required.");
 if(float.status!=="externally_reconciled"||float.requestId!==job.requestId||
    !float.returnReference||!float.reconciledBy)
   fail("The external purchasing float must be separately reconciled.");
 const q=request.finalQuote||{};
 if(q.currency!=="USD"||job.currency!=="USD"||float.currency!=="USD")fail("Currency mismatch.");
 const captured=refundCents(request.fundedAmount);
 const merchandise=refundCents(q.merchandiseTotal);
 const fee=refundCents(q.shoppingFee)+refundCents(q.deliveryFee);
 const actual=refundCents(job.actualSpend);
 const transferred=refundCents(float.amount);
 const returned=refundCents(float.returnedAmount);
 if(captured!==refundCents(q.total)||captured!==merchandise+fee||
    actual>merchandise||actual+returned!==transferred)
   fail("Actual spend, quote, captured funds and external float do not balance.");
 const summary=refundSummary(refunds);
 if(summary.pending>0)fail("One or more customer refunds are still unresolved.");
 const refunded=refundCents(summary.reconciled);
 if(refunded<merchandise-actual||refunded>captured-actual)
   fail("Customer refunds do not reconcile with unspent merchandise.");
 const serviceRevenue=captured-actual-refunded;
 if(serviceRevenue<0||serviceRevenue>fee)fail("Service fee balance is inconsistent.");
 return {currency:"USD",captured:captured/100,verifiedPurchase:actual/100,
   refunded:refunded/100,retainedServiceFees:serviceRevenue/100,
   floatTransferred:transferred/100,floatReturned:returned/100,
   independentlySettled:true};
}
