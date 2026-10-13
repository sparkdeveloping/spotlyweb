import { groceryCatalogTemplates } from "./catalog-templates.js";
import { productSearchTerms } from "../lib/catalog-library.js";

function slug(value) {
  return String(value || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

const seen = new Set();
const records = [];
for (const template of groceryCatalogTemplates.filter((item) => item.businessTypes?.includes("grocery_retail"))) {
  for (const item of template.products || []) {
    const name = item.name || "";
    const key = name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const referenceOnly = Boolean(template.sourceReviewRequired || item.sourceStatus);
    records.push({
      id: `mp-${slug(name)}`,
      canonicalName: name,
      brand: item.brand || "",
      variant: "",
      packSize: "",
      unit: "",
      barcode: item.barcode || "",
      gtin: item.barcode || "",
      categoryPath: [item.category || template.name || "Groceries"],
      description: "",
      manufacturer: item.brand || "",
      country: "Zimbabwe",
      primaryImage: "",
      additionalImages: [],
      searchAliases: [],
      sourceType: referenceOnly ? "reference_catalogue" : "spotly_starter",
      sourceReferences: template.sourceNotes || [],
      sourceRightsStatus: referenceOnly ? "reference_only" : "spotly_created",
      imageRightsStatus: "reference_only",
      verificationStatus: referenceOnly ? "needs_review" : "verified",
      ageRestricted: false,
      searchTerms: productSearchTerms(name, item.brand, item.category, item.barcode),
      starter: true
    });
  }
}

export const starterMasterProducts = records;

export const starterCatalogCollections = groceryCatalogTemplates.filter((item) => item.businessTypes?.includes("grocery_retail")).map((template) => ({
  id: `collection-${template.id}`,
  name: template.sourceReviewRequired ? `${template.name} — reference set` : template.name,
  description: template.description || "",
  businessTypes: template.businessTypes || ["grocery_retail"],
  masterProductIds: (template.products || []).map((item) => `mp-${slug(item.name)}`).filter((id) => records.some((product) => product.id === id)),
  rightsStatus: template.sourceReviewRequired ? "reference_only" : "spotly_created",
  publicationStatus: template.sourceReviewRequired ? "internal_reference" : "active",
  sourceReferences: template.sourceNotes || []
}));
