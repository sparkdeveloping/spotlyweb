/**
 * Evidence-led discovery signals for Zimbabwe. Editorial signals are not
 * customer reviews, merchant verification, or proof of branch opening.
 * A recognized brand only gets a modest boost inside its commerce-readiness tier.
 * Explicit branch closure reports trigger re-verification, not automatic deletion.
 */
const CHAINS = [
  { id: "tm-pick-n-pay", pattern: /(?:^|\b)(?:tm\s+pick\s*(?:n|and|&)\s*pay|pick\s*(?:n|and|&)\s*pay|tm\s+supermarkets?|tm\s+supermarket)(?:\b|$)/i, weight: 18, source: "https://tmwebstore.quatrohaus.com/hampers/1" },
  { id: "bon-marche", pattern: /(?:^|\b)bon\s*marche(?:\b|$)/i, weight: 18, source: "https://www.zse.co.zw/wp-content/uploads/2025/12/OKZ.zw-2025-Annual-Report.pdf" },
  { id: "spar-zimbabwe", pattern: /(?:^|\b)spar(?:\b|$)/i, weight: 15, source: "https://spar-international.com/country/zimbabwe/" },
  { id: "ok-zimbabwe", pattern: /^(?:ok(?:\s+zimbabwe|\s+supermarkets?|\s+mart)?)(?:\s|$)/i, weight: 14, source: "https://www.zse.co.zw/wp-content/uploads/2025/12/OKZ.zw-2025-Annual-Report.pdf" },
  { id: "food-lovers-market", pattern: /(?:^|\b)food\s+lover'?s?\s+market(?:\b|$)/i, weight: 12, source: "https://foodloversmarket.co.za/stores/zimbabwe/food-lovers-market-greendale/" }
];

const REPORTED_CLOSURES = [
  { chain: "food-lovers-market", city: "harare", area: /\bborrowdale\b/i, date: "2025-06-30", source: "https://okziminvestor.com/ok-zimbabwe-announcement-of-closure-of-food-lovers-market-stores/" },
  { chain: "food-lovers-market", city: "harare", area: /\bavondale\b/i, date: "2025-06-30", source: "https://okziminvestor.com/ok-zimbabwe-announcement-of-closure-of-food-lovers-market-stores/" },
  { chain: "tm-pick-n-pay", city: "mutare", area: /\bchikanga\b/i, date: "2026-02-28", source: "https://www.heraldonline.co.zw/tm-pick-n-pay-shuts-chikanga-dangamvura-branches/" },
  { chain: "tm-pick-n-pay", city: "mutare", area: /\bdangamvura\b/i, date: "2026-02-28", source: "https://www.heraldonline.co.zw/tm-pick-n-pay-shuts-chikanga-dangamvura-branches/" }
];

function normal(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").toLowerCase().trim();
}

/** The signals deliberately match a business NAME, never category keywords or search tags. */
export function marketplaceEditorial(record = {}) {
  const name = normal(record.name || record.brandName);
  const brand = normal(record.brandName);
  const chain = CHAINS.find((candidate) => candidate.pattern.test(name) || (brand && candidate.pattern.test(brand)));
  if (!chain) return { signal: "unassessed", score: 0, customerRating: false, branchReviewRequired: false };
  const city = normal(record.city);
  const area = normal([record.area, record.suburb, record.address, record.name].filter(Boolean).join(" "));
  const closure = REPORTED_CLOSURES.find((candidate) => candidate.chain === chain.id && city === candidate.city && candidate.area.test(area));
  const notPublished = ["closed", "archived", "removed"].includes(normal(record.status));
  return {
    signal: closure ? "branch_reverification_required" : "established_retail_brand",
    brandId: chain.id,
    score: closure || notPublished ? -45 : chain.weight,
    customerRating: false,
    branchReviewRequired: Boolean(closure),
    evidenceUrl: closure?.source || chain.source,
    evidenceDate: closure?.date || null,
    label: closure ? "Branch needs re-verification" : "Established retail brand",
    // Editorial recognition does not imply this particular branch is open or that Spotly sells its products.
    merchantVerified: false,
    openNowVerified: false
  };
}
