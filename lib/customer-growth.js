export function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

export function normalizePromotionCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

function dateKey(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const candidate = typeof value?.toDate === "function" ? value.toDate() : value;
  const date = candidate instanceof Date ? candidate : new Date(candidate);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function promotionWindowActive(promotion = {}, now = new Date()) {
  if (promotion.active === false || promotion.status === "paused" || promotion.status === "archived") return false;
  const today = dateKey(now);
  const starts = dateKey(promotion.startsAt);
  const ends = dateKey(promotion.endsAt);
  if (starts && starts > today) return false;
  if (ends && ends < today) return false;
  return true;
}

export function promotionEligibleSubtotal(promotion = {}, lines = []) {
  const scoped = Array.isArray(promotion.productIds) ? promotion.productIds.filter(Boolean) : [];
  if (!scoped.length) return money(lines.reduce((sum, line) => sum + money(line.lineTotal), 0));
  const allowed = new Set(scoped);
  return money(lines.reduce((sum, line) => allowed.has(line.productId) ? sum + money(line.lineTotal) : sum, 0));
}

export function promotionQuote(promotion = {}, context = {}) {
  const code = normalizePromotionCode(context.code);
  const expectedCode = normalizePromotionCode(promotion.code);
  const currency = String(context.currency || "USD").toUpperCase();
  const branchId = String(context.branchId || "");
  const businessId = String(context.businessId || "");
  const lines = Array.isArray(context.lines) ? context.lines : [];
  const subtotal = money(context.subtotal ?? lines.reduce((sum, line) => sum + money(line.lineTotal), 0));

  if (!promotionWindowActive(promotion, context.now || new Date())) return { eligible: false, reason: "This promotion is not active." };
  const platformScope = promotion.scope === "platform";
  if (!platformScope && promotion.businessId && businessId && promotion.businessId !== businessId) return { eligible: false, reason: "This promotion is for another business." };
  if (platformScope && Array.isArray(promotion.businessIds) && promotion.businessIds.length && businessId && !promotion.businessIds.includes(businessId)) return { eligible: false, reason: "This Spotly offer is not available for this business." };
  if (expectedCode && code !== expectedCode) return { eligible: false, reason: "That promotion code is not valid." };
  if (!expectedCode && code) return { eligible: false, reason: "That code does not match this promotion." };
  if (Number(promotion.usageLimit || 0) > 0 && Number(promotion.usedCount || 0) >= Number(promotion.usageLimit)) return { eligible: false, reason: "This promotion has reached its usage limit." };
  if (Array.isArray(promotion.branchIds) && promotion.branchIds.length && !promotion.branchIds.includes(branchId)) return { eligible: false, reason: "This promotion is not available at this location." };
  if (promotion.currency && promotion.type !== "percentage" && String(promotion.currency).toUpperCase() !== currency) return { eligible: false, reason: `This promotion is not available in ${currency}.` };
  const audience = promotion.audience || "all_customers";
  if (audience === "new_customers" && context.isNewCustomer !== true) return { eligible: false, reason: "This promotion is for new Spotly customers." };
  if (audience === "returning_customers" && context.isNewCustomer !== false) return { eligible: false, reason: "This promotion is for returning Spotly customers." };
  if (audience === "private_beta" && context.privateBeta !== true) return { eligible: false, reason: "This promotion is limited to approved preview customers." };
  if (subtotal < money(promotion.minimumSpend)) return { eligible: false, reason: `Spend at least ${money(promotion.minimumSpend).toFixed(2)} ${currency} to use this promotion.` };

  const eligibleSubtotal = promotionEligibleSubtotal(promotion, lines);
  if (eligibleSubtotal <= 0) return { eligible: false, reason: "None of the selected items qualify for this promotion." };
  const raw = promotion.type === "percentage"
    ? eligibleSubtotal * Math.max(0, Math.min(100, Number(promotion.value || 0))) / 100
    : Math.max(0, Number(promotion.value || 0));
  const discount = money(Math.min(eligibleSubtotal, raw));
  if (discount <= 0) return { eligible: false, reason: "This promotion does not reduce this order." };

  return {
    eligible: true,
    discount,
    eligibleSubtotal,
    code: expectedCode,
    promotionId: promotion.id || "",
    label: promotion.name || (promotion.type === "percentage" ? `${promotion.value}% off` : `${promotion.value} ${promotion.currency || currency} off`)
  };
}

export function chooseBestAutomaticPromotion(promotions = [], context = {}) {
  return promotions
    .filter((promotion) => !normalizePromotionCode(promotion.code))
    .map((promotion) => ({ promotion, quote: promotionQuote(promotion, { ...context, code: "" }) }))
    .filter(({ quote }) => quote.eligible)
    .sort((a, b) => b.quote.discount - a.quote.discount)[0] || null;
}

export function publicPromotionRecord(promotion = {}) {
  return {
    id: promotion.id || "",
    name: promotion.name || "Offer",
    description: promotion.description || "",
    code: normalizePromotionCode(promotion.code),
    type: ["fixed", "free_item"].includes(promotion.type) ? promotion.type : "percentage",
    value: money(promotion.value),
    currency: promotion.currency || "USD",
    minimumSpend: money(promotion.minimumSpend),
    branchIds: Array.isArray(promotion.branchIds) ? promotion.branchIds.slice(0, 100) : [],
    productIds: Array.isArray(promotion.productIds) ? promotion.productIds.slice(0, 200) : [],
    startsAt: dateKey(promotion.startsAt),
    endsAt: dateKey(promotion.endsAt),
    audience: promotion.audience || "all_customers",
    scope: promotion.scope === "platform" ? "platform" : "business",
    businessIds: Array.isArray(promotion.businessIds) ? promotion.businessIds.slice(0, 250) : []
  };
}

export function referralCodeLooksValid(value) {
  return /^[A-Z0-9]{6,12}$/.test(String(value || "").trim().toUpperCase());
}
