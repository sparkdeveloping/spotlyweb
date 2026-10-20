import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {createPaynow,normalizePaynowStatus} from "@/lib/paynow-server";
import {applyAssistPaymentUpdate} from "@/lib/assist-payment-server";
export const runtime="nodejs";
const schema=z.object({requestId:z.string().min(12).max(250)}).strict();
export async function POST(request){
 try{
  const user=await authenticateRequest(request),input=schema.parse(await request.json());
  const {db,messaging,auth}=getAdminServices();
  const snap=await db.collection("independentShoppingRequests").doc(input.requestId).get();
  if(!snap.exists||snap.data().customerId!==user.uid)throw Object.assign(new Error("Shopping request not found."),{status:404});
  const reference=snap.data().paymentIntentReference;
  if(!reference)return Response.json({ok:true,state:"not_initiated"});
  const intent=await db.collection("paymentIntents").doc(reference).get();
  if(!intent.exists||intent.data().model!=="independent_shopping")throw Object.assign(new Error("Independent payment intent not found."),{status:404});
  if(!intent.data().pollUrl)return Response.json({ok:true,state:intent.data().status||"initiated"});
  const provider=await createPaynow("USD");
  const normalized=normalizePaynowStatus(await provider.pollTransaction(intent.data().pollUrl));
  normalized.reference=normalized.reference||reference;
  const applied=await applyAssistPaymentUpdate(db,reference,normalized,{source:"paynow_status_poll",messaging,auth});
  return Response.json({ok:true,state:applied.state,captured:applied.captured,anomaly:applied.anomaly});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Choose a valid independent payment request."},{status:422});
  return apiError(error);
 }
}
