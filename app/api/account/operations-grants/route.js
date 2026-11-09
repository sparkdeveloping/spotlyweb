import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { loadOperationGrants, serializeOperationGrant } from "@/lib/operations-grants-server";
import { operationContext } from "@/lib/operations-grants";

export const runtime = "nodejs";
export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const url = new URL(request.url);
    const scope = { service: url.searchParams.get("service") || "", country: url.searchParams.get("country") || "", city: url.searchParams.get("city") || "" };
    const { db } = getAdminServices();
    const grants = await loadOperationGrants(db, user.uid);
    return Response.json({ ok: true, context: operationContext(grants, scope), grants: grants.map((grant) => serializeOperationGrant(grant.id, grant)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
