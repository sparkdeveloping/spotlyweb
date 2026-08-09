import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { productSearchTerms } from "@/lib/catalog-library";

export function masterProductPayload(values = {}, actorId = null) {
  const canonicalName = String(values.canonicalName || values.name || "").trim();
  const brand = String(values.brand || "").trim();
  const barcode = String(values.gtin || values.barcode || "").replace(/\s+/g, "").trim();
  const categoryPath = Array.isArray(values.categoryPath) ? values.categoryPath.filter(Boolean).slice(0, 8) : [values.category || "Groceries"];
  return {
    canonicalName,
    brand,
    variant: String(values.variant || "").trim(),
    packSize: String(values.packSize || "").trim(),
    unit: String(values.unit || "").trim(),
    barcode,
    gtin: barcode,
    categoryPath,
    description: String(values.description || "").trim().slice(0, 1200),
    manufacturer: String(values.manufacturer || brand || "").trim(),
    country: String(values.country || "Zimbabwe").trim(),
    primaryImage: values.primaryImage || "",
    additionalImages: values.additionalImages || [],
    searchAliases: values.searchAliases || [],
    sourceType: values.sourceType || "spotly_field_capture",
    sourceReferences: values.sourceReferences || [],
    sourceRightsStatus: values.sourceRightsStatus || "spotly_created",
    imageRightsStatus: values.imageRightsStatus || (values.primaryImage ? "spotly_photographed" : "reference_only"),
    verificationStatus: values.verificationStatus || "needs_review",
    ageRestricted: Boolean(values.ageRestricted),
    metadata: values.metadata || {},
    searchTerms: productSearchTerms(canonicalName, brand, values.variant, values.packSize, barcode, categoryPath),
    lastObservedAt: values.lastObservedAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorId
  };
}

export async function findMasterProductByBarcode(db, barcode) {
  const value = String(barcode || "").replace(/\s+/g, "").trim();
  if (!value) return null;
  const snapshot = await db.collection("masterProducts").where("gtin", "==", value).limit(1).get();
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}
