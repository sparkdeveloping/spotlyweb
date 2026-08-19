import "server-only";

export function appUrl(request) {
  const requestUrl = new URL(request.url);
  const host = (request.headers?.get?.("x-forwarded-host") || request.headers?.get?.("host") || requestUrl.hostname).split(":")[0].toLowerCase();
  // Customer/payment callbacks have one canonical public origin even though the same
  // Vercel deployment serves several Spotly workspace subdomains.
  if (host === "spotlyafrica.com" || host === "www.spotlyafrica.com" || host.endsWith(".spotlyafrica.com")) return "https://spotlyafrica.com";
  return process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
}

export function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, cleanObject(item)])
    );
  }
  return value;
}

export function normalizeZimbabwePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("263")) return `+${digits}`;
  if (digits.startsWith("0")) return `+263${digits.slice(1)}`;
  if (digits.length === 9) return `+263${digits}`;
  return value.trim();
}

export function safeText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export function toPlainTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}
