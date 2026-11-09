import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateParcel, normalizeParcelPoint, parcelQuoteAvailability } from "@/lib/parcel-server";
import { validateSendTerritory } from "@/lib/send-territory";
import { getVerifiedRideRoute } from "@/lib/ride-routing";
import { requireOperationGrant } from "@/lib/operations-grants-server";

export const runtime="nodejs";
const point=z.object({lat:z.number().finite(),lng:z.number().finite(),country:z.enum(["ZW","MW"]),label:z.string().max(160).optional(),formattedAddress:z.string().max(500).optional(),city:z.string().max(100).optional(),area:z.string().max(100).optional(),accuracy:z.number().finite().optional()});
const schema=z.object({pickup:point,dropoff:point,parcelSize:z.string().min(1).max(40)}).strict();
export async function POST(request){try{const user=await authenticateRequest(request);await enforceRateLimit(request,{key:"operations-send",limit:20,windowMs:60000,identity:user.uid});const body=schema.parse(await request.json());const pickup=normalizeParcelPoint(body.pickup),dropoff=normalizeParcelPoint(body.dropoff);if(!pickup||!dropoff)throw Object.assign(new Error("Choose valid pickup and drop-off locations."),{status:400});const {db}=getAdminServices();await requireOperationGrant(db,user.uid,{type:"service_operations",service:"send",country:pickup.country,city:pickup.city});const settingsSnap=await db.collection("platformSettings").doc("global").get(),settings=settingsSnap.data()||{};const readiness=parcelQuoteAvailability(settings,pickup);if(!readiness.enabled)throw Object.assign(new Error(readiness.reason),{status:409});validateSendTerritory(pickup,dropoff,readiness.config);const route=await getVerifiedRideRoute(pickup,dropoff);const quote=estimateParcel({pickup,dropoff,parcelSize:body.parcelSize,settings,route});const ref=db.collection("operationsRuns").doc();await ref.create({kind:"send",mode:"operations",operations:true,customerId:user.uid,state:"quoted",pickup,dropoff,parcelSize:body.parcelSize,quote,financialIsolation:true,productionCollectionsUntouched:true,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return Response.json({ok:true,runId:ref.id,state:"quoted",operations:true,quote});}catch(error){if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the Operations Send details."},{status:400});return apiError(error);}}
