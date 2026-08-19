import { NextResponse } from "next/server";

const PORTALS = {
  "business.spotlyafrica.com": "/business",
  "admin.spotlyafrica.com": "/admin",
  "driver.spotlyafrica.com": "/driver",
  "staff.spotlyafrica.com": "/staff"
};

const PATH_TO_HOST = {
  business: "business.spotlyafrica.com",
  admin: "admin.spotlyafrica.com",
  driver: "driver.spotlyafrica.com",
  staff: "staff.spotlyafrica.com"
};

const SHARED_PREFIXES = [
  "/api", "/_next", "/brand", "/lottie", "/icons", "/favicon", "/manifest", "/firebase-messaging-sw.js",
  "/login", "/account", "/support", "/privacy", "/terms", "/payment", "/claim", "/marketplace", "/drive"
];

function hostname(request) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function productionUrl(request, host, pathname) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = host;
  url.port = "";
  if (pathname !== undefined) url.pathname = pathname;
  return url;
}

function isSharedPath(pathname) {
  return SHARED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request) {
  const host = hostname(request);
  const { pathname } = request.nextUrl;
  const isSpotlyHost = host === "spotlyafrica.com" || host === "www.spotlyafrica.com" || host.endsWith(".spotlyafrica.com");
  if (!isSpotlyHost) return NextResponse.next();

  // IMPORTANT: serve both apex and www as customer hosts. Vercel may be configured
  // to canonicalize either direction at the domain layer; redirecting the opposite
  // direction here creates ERR_TOO_MANY_REDIRECTS. Canonical-domain choice belongs
  // in Vercel Domains, not application proxy code.
  if (host === "spotlyafrica.com" || host === "www.spotlyafrica.com") {
    const firstSegment = pathname.split("/").filter(Boolean)[0];
    const destinationHost = PATH_TO_HOST[firstSegment];
    if (destinationHost) {
      const cleanPath = pathname === `/${firstSegment}` ? "/" : pathname.slice(firstSegment.length + 1) || "/";
      return NextResponse.redirect(productionUrl(request, destinationHost, cleanPath), 308);
    }
    return NextResponse.next();
  }

  const portalPrefix = PORTALS[host];
  if (!portalPrefix) return NextResponse.next();

  // Old deep links such as business.spotlyafrica.com/business/orders become
  // business.spotlyafrica.com/orders. The visible URL no longer repeats the portal.
  if (pathname === portalPrefix || pathname.startsWith(`${portalPrefix}/`)) {
    const cleanPath = pathname === portalPrefix ? "/" : pathname.slice(portalPrefix.length) || "/";
    return NextResponse.redirect(productionUrl(request, host, cleanPath), 308);
  }

  // APIs and global account/support/auth routes must remain unprefixed and retain
  // the current origin so Firebase Auth cookies/tokens and callbacks stay origin-safe.
  if (isSharedPath(pathname)) return NextResponse.next();

  // Clean portal URLs are internally mapped to the existing Next.js route tree.
  // / on business.* renders /business; /orders renders /business/orders, etc.
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? portalPrefix : `${portalPrefix}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|lottie/).*)"]
};
