import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { loadBusinessLifecycleData, publicLifecycleSnapshot } from "@/lib/business-lifecycle-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const READ_ROLES = [
  "organization_owner",
  "business_owner",
  "business_manager",
  "branch_manager",
  "finance_manager",
  "order_manager",
  "catalog_manager",
  "order_staff",
  "picker",
  "finance_viewer",
  "custom"
];

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const businessId = new URL(request.url).searchParams.get("businessId") || "";
    if (businessId.length < 3 || businessId.length > 200) {
      throw Object.assign(new Error("Choose a valid business."), { status: 400 });
    }
    const { db } = getAdminServices();
    const context = await requireBusinessPermission(db, user, businessId, "business.read", { allowRoles: READ_ROLES });
    const { lifecycle } = await loadBusinessLifecycleData(db, businessId, { membership: context.membership, userId: user.uid });
    return Response.json({
      ok: true,
      businessId,
      generatedAt: new Date().toISOString(),
      lifecycle: publicLifecycleSnapshot(lifecycle)
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return apiError(error);
  }
}
