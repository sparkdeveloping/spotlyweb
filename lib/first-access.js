// Browser-safe launch attribution vocabulary. Never infer a visitor's identity from it.
export const FIRST_ACCESS_INTERESTS = Object.freeze([
  ["bite", "Spotly Bite"], ["shopper", "Spotly Shopper"], ["ride", "Spotly Ride"],
  ["send", "Spotly Send"], ["book", "Spotly Book"], ["live", "Spotly Live"],
  ["places", "Local places"], ["business", "For my business"], ["assist", "Spotly Assist"]
]);
export const FIRST_ACCESS_CHANNELS = Object.freeze(["whatsapp", "instagram", "facebook", "tiktok", "youtube", "x", "google", "email", "referral", "direct", "other"]);
export const FIRST_ACCESS_STATUSES = Object.freeze(["new", "contacted", "qualified", "invited", "activated", "not_interested"]);
const clean = (value, length = 80) => String(value || "").trim().slice(0, length);
export function classifyChannel({ utm_source = "", referrer = "", via = "" } = {}) {
  const source = clean(utm_source, 80).toLowerCase();
  const hostname = (() => { try { return new URL(referrer).hostname.toLowerCase(); } catch { return ""; } })();
  const candidate = `${source} ${hostname}`;
  if (/whatsapp|wa\.me|wa\.link/.test(candidate)) return "whatsapp";
  if (/instagram|instagr\.am/.test(candidate)) return "instagram";
  if (/facebook|fb\.com|fb\.me|messenger/.test(candidate)) return "facebook";
  if (/tiktok/.test(candidate)) return "tiktok";
  if (/youtube|youtu\.be/.test(candidate)) return "youtube";
  if (/twitter|t\.co|(^|\s)x(\s|$)/.test(candidate)) return "x";
  if (/google/.test(candidate)) return "google";
  if (/email|newsletter|mailchimp/.test(candidate)) return "email";
  if (via) return "referral";
  return source || hostname ? "other" : "direct";
}
export function normalizeAttribution(input = {}) {
  const referral = clean(input.referrer, 300);
  const source = clean(input.utm_source || input.utmSource, 80);
  const via = clean(input.via || input.referralCode, 48);
  return {
    utm_source: source,
    utm_medium: clean(input.utm_medium || input.utmMedium, 80),
    utm_campaign: clean(input.utm_campaign || input.utmCampaign, 96),
    utm_content: clean(input.utm_content || input.utmContent, 96),
    utm_term: clean(input.utm_term || input.utmTerm, 96),
    via,
    // Retain only the referring origin, never its path, query parameters or tokens.
    referrer: /^https?:\/\//i.test(referral) ? (() => { try { return new URL(referral).origin; } catch { return ""; } })() : "",
    channel: classifyChannel({ utm_source: source, referrer: referral, via })
  };
}
export function campaignLink({ base = "https://spotlyafrica.com/", source = "whatsapp", campaign = "first-access", medium = "social", content = "" } = {}) {
  const url = new URL(base);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);
  return url.toString();
}
