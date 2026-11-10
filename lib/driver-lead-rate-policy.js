// Recruitment signups often share carrier-grade NAT and office networks.
// Keep a high network-wide flood ceiling, with a strict per-contact retry limit.
// Bump key versions when changing identity semantics to avoid carrying over
// counters from older, overly restrictive policies.
export const DRIVER_LEAD_RATE_POLICY = Object.freeze({
  network: Object.freeze({
    key: "public-driver-lead-network-v2",
    limit: 500,
    windowMs: 30 * 60_000,
    scope: "network",
  }),
  contact: Object.freeze({
    key: "public-driver-lead-contact-v2",
    limit: 15,
    windowMs: 30 * 60_000,
    scope: "contact",
  }),
});
