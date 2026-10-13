import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(3).max(180),
  productId: z.string().min(3).max(180).optional(),
  sourceStoragePath: z.string().min(3).max(1000),
  mode: z.enum(["clean_background", "improve_lighting", "straighten_crop", "professional_product", "transparent_background"]).default("clean_background")
});

const MODE_PROMPTS = {
  clean_background: "Clean the background into a simple professional ecommerce product-photo background while preserving the product exactly.",
  improve_lighting: "Improve exposure, white balance, clarity, and product lighting. Keep the original background unless a small cleanup is necessary.",
  straighten_crop: "Straighten the photographed product, correct perspective gently, and create a clean centered ecommerce crop.",
  professional_product: "Make this look like a professional retailer product photograph with clean lighting and an unobtrusive studio-style background.",
  transparent_background: "Remove the background and return the product isolated on a transparent background."
};

function promptFor(mode) {
  return `${MODE_PROMPTS[mode]}\n\nThis is a factual packaged-product photograph. Preserve identity with high fidelity. Do not change the brand logo, package structure, product variant, label wording, weight or volume, product color, barcode, certifications, claims, ingredients, or any printed information. Do not invent packaging elements. If text cannot be preserved faithfully, leave it as close to the source image as possible rather than inventing replacements.`;
}

function downloadUrl(bucketName, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "product-image-enhance", identity: user.uid, limit: 20, windowMs: 60 * 60_000 });
    const body = schema.parse(await request.json());
    const { db, storage } = getAdminServices();
    await requireBusinessPermission(db, user, body.businessId, "catalog.update", { allowRoles: ["organization_owner", "business_owner", "business_manager", "catalog_manager"] });
    const productRef = body.productId ? db.collection("products").doc(body.productId) : null;
    const productSnapshot = productRef ? await productRef.get() : null;
    if (productRef && (!productSnapshot.exists || productSnapshot.data().businessId !== body.businessId)) throw Object.assign(new Error("The product was not found in this business."), { status: 404 });
    const allowedPrefix = `businesses/${body.businessId}/catalog/`;
    if (!body.sourceStoragePath.startsWith(allowedPrefix)) throw Object.assign(new Error("The source image does not belong to this business catalogue."), { status: 403 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw Object.assign(new Error("Spotly image enhancement is not configured yet."), { status: 503 });
    const transparentMode = body.mode === "transparent_background";
    const model = transparentMode
      ? (process.env.OPENAI_TRANSPARENT_IMAGE_MODEL || "gpt-image-1.5")
      : (process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
    const bucket = storage.bucket();
    const sourceFile = bucket.file(body.sourceStoragePath);
    const [exists] = await sourceFile.exists();
    if (!exists) throw Object.assign(new Error("The original product image could not be found."), { status: 404 });
    const [metadata] = await sourceFile.getMetadata();
    const contentType = metadata.contentType || "image/jpeg";
    if (!contentType.startsWith("image/")) throw Object.assign(new Error("The source file is not a supported image."), { status: 422 });
    const [sourceBytes] = await sourceFile.download();
    if (sourceBytes.length > 20 * 1024 * 1024) throw Object.assign(new Error("The source image is too large for enhancement."), { status: 413 });

    const editPayload = {
      model,
      images: [{ image_url: `data:${contentType};base64,${sourceBytes.toString("base64")}` }],
      prompt: promptFor(body.mode),
      quality: "medium",
      size: "1024x1024",
      output_format: "png",
      moderation: "auto",
      user: user.uid,
      ...(transparentMode ? { background: "transparent", input_fidelity: "high" } : {})
    };

    const openAIResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(editPayload)
    });
    const result = await openAIResponse.json().catch(() => ({}));
    if (!openAIResponse.ok) {
      const detail = result?.error?.message || "The image service could not complete this edit.";
      console.error("OpenAI image edit failed", { status: openAIResponse.status, detail, businessId: body.businessId, productId: body.productId || null });
      throw Object.assign(new Error(openAIResponse.status === 429 ? "Image enhancement is busy. Try again shortly." : "Spotly could not enhance this image. Your original is unchanged."), { status: openAIResponse.status === 429 ? 429 : 502 });
    }
    const encoded = result?.data?.[0]?.b64_json;
    if (!encoded) throw Object.assign(new Error("The image service returned no edited image. Your original is unchanged."), { status: 502 });
    const enhancedBytes = Buffer.from(encoded, "base64");
    const enhancedPath = `businesses/${body.businessId}/catalog/enhanced/${body.productId || "draft"}/${randomUUID()}.png`;
    const token = randomUUID();
    await bucket.file(enhancedPath).save(enhancedBytes, { resumable: false, metadata: { contentType: "image/png", cacheControl: "private,max-age=3600", metadata: { firebaseStorageDownloadTokens: token, sourceProductId: body.productId || "", sourceImagePath: body.sourceStoragePath, enhancedWithAI: "true", model, enhancementMode: body.mode } } });
    const enhancedUrl = downloadUrl(bucket.name, enhancedPath, token);
    const imageRef = db.collection("productImageVersions").doc();
    await imageRef.set({ businessId: body.businessId, businessProductId: body.productId || null, type: "enhanced", storagePath: enhancedPath, url: enhancedUrl, sourceStoragePath: body.sourceStoragePath, sourceImageId: productSnapshot?.data?.()?.imageVersionId || null, enhancedWithAI: true, model, enhancementMode: body.mode, approvalStatus: "pending", createdBy: user.uid, createdAt: FieldValue.serverTimestamp() });
    await db.collection("auditLogs").add({ action: "product_image.enhanced", entityType: "productImageVersion", entityId: imageRef.id, actorId: user.uid, actorEmail: user.email || "", metadata: { businessId: body.businessId, productId: body.productId || null, mode: body.mode, model }, createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, imageVersion: { id: imageRef.id, url: enhancedUrl, storagePath: enhancedPath, model, mode: body.mode, approvalStatus: "pending" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the product image request." }, { status: 400 });
    return apiError(error);
  }
}
