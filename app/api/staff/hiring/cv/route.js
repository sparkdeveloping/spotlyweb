import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireSpotlyStaffPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db, storage } = getAdminServices();
    await requireSpotlyStaffPermission(db, user, "recruitment.read", { roles: ["people_operations_admin", "operations_manager", "platform_admin"] });
    const applicationId = new URL(request.url).searchParams.get("applicationId") || "";
    if (!applicationId) throw Object.assign(new Error("Application ID is required."), { status: 400 });
    const snapshot = await db.collection("careerApplications").doc(applicationId).get();
    if (!snapshot.exists || !snapshot.data()?.cv?.path) throw Object.assign(new Error("This application does not have a CV attachment."), { status: 404 });
    const record = snapshot.data().cv;
    const [bytes] = await storage.bucket().file(record.path).download();
    const safeName = String(record.fileName || "cv.pdf").replace(/[\r\n\"\\]/g, "_");
    return new Response(bytes, { headers: { "Content-Type": record.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
