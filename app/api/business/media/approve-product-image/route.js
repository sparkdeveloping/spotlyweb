import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
const schema = z.object({ businessId: z.string().min(3).max(180), productId: z.string().min(3).max(180).optional(), imageVersionId: z.string().min(3).max(180), decision: z.enum(["approve", "reject"]) });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    await requireBusinessPermission(db, user, body.businessId, "catalog.update", { allowRoles: ["organization_owner", "business_owner", "business_manager", "catalog_manager"] });
    const productRef = body.productId ? db.collection("products").doc(body.productId) : null;
    const imageRef = db.collection("productImageVersions").doc(body.imageVersionId);
    let responseImage = null;
    await db.runTransaction(async (transaction) => {
      const image = await transaction.get(imageRef);
      const product = productRef ? await transaction.get(productRef) : null;
      if (productRef && (!product.exists || product.data().businessId !== body.businessId)) throw Object.assign(new Error("The product was not found."), { status: 404 });
      if (!image.exists || image.data().businessId !== body.businessId || (body.productId && image.data().businessProductId && image.data().businessProductId !== body.productId)) throw Object.assign(new Error("The image version was not found."), { status: 404 });
      const imageData = image.data();
      transaction.set(imageRef, { approvalStatus: body.decision === "approve" ? "approved" : "rejected", approvedBy: body.decision === "approve" ? user.uid : null, approvedAt: body.decision === "approve" ? FieldValue.serverTimestamp() : null, reviewedBy: user.uid, reviewedAt: FieldValue.serverTimestamp(), ...(body.productId && !imageData.businessProductId ? { businessProductId: body.productId } : {}) }, { merge: true });
      if (body.decision === "approve" && productRef) transaction.set(productRef, { image: imageData.url, imageStoragePath: imageData.storagePath, imageVersionId: body.imageVersionId, imageRightsStatus: product.data().imageRightsStatus || "merchant_owned", imageProvenance: { type: "ai_enhanced", sourceStoragePath: imageData.sourceStoragePath, imageVersionId: body.imageVersionId, model: imageData.model || "", approvedBy: user.uid }, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
      responseImage = { url: imageData.url, storagePath: imageData.storagePath, imageVersionId: body.imageVersionId, model: imageData.model || "", sourceStoragePath: imageData.sourceStoragePath };
      transaction.create(db.collection("auditLogs").doc(), { action: `product_image.${body.decision}d`, entityType: "productImageVersion", entityId: body.imageVersionId, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: body.businessId, productId: body.productId || null }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, image: responseImage });
  } catch (error) { return apiError(error); }
}
