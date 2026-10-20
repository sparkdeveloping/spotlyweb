/** Money and refund eligibility for unaffiliated Spotly Assist purchases.
 * All calculations use integer cents. External provider refund execution is NOT available here.
 */
const fail=(message)=>{throw Object.assign(new Error(message),{status:409})};
export function refundCents(value){
 if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>1000000||
    Math.abs(value*100-Math.round(value*100))>1e-6)fail("Refund values must use exact non-negative cents.");
 return Math.round(value*100);
}
export function authorizedRefundCapacity(request={},refunds=[],excludedId=""){
 if(request.paymentStatus!=="paid_held")fail("No confirmed independent customer funds exist.");
 const funded=refundCents(request.fundedAmount);
 if(!funded)fail("A confirmed positive customer balance is required.");
 let reserved=0;
 for(const r of refunds){
  if(!r||r.id===excludedId||["voided","rejected"].includes(r.status))continue;
  reserved+=refundCents(r.amount);
 }
 if(reserved>funded)fail("Existing refund commitments exceed captured customer funds.");
 return (funded-reserved)/100;
}
export function refundReadyForConfirmation(refund={},actorUid="",otherRefunds=[],request={}){
 if(refund.status!=="external_evidence_submitted")fail("External refund execution evidence must be submitted first.");
 if(!refund.externalReference||!refund.evidenceUrl||!refund.executedBy||
     !refund.executionNote||refund.executionNote.trim().length<20)fail("Refund evidence is incomplete.");
 if(!actorUid||actorUid===refund.executedBy||actorUid===refund.requestedBy)
   fail("A separate Finance reviewer must confirm the external refund evidence.");
 const capacity=authorizedRefundCapacity(request,otherRefunds,refund.id);
 if(refundCents(refund.amount)>refundCents(capacity))fail("Refund exceeds the remaining customer-funded balance.");
 return {amount:refund.amount,currency:"USD",externalReference:refund.externalReference,
   executedBy:refund.executedBy,confirmedBy:actorUid};
}
export function refundSummary(refunds=[]){
 const active=refunds.filter(r=>r&&!["voided","rejected"].includes(r.status));
 const pending=active.filter(r=>r.status!=="reconciled_external");
 const reconciled=active.filter(r=>r.status==="reconciled_external");
 const sum=list=>list.reduce((value,r)=>value+refundCents(r.amount),0)/100;
 return {pending:sum(pending),reconciled:sum(reconciled),
   status:pending.length?"awaiting_provider_reconciliation":reconciled.length?"reconciled_external":"not_required"};
}
