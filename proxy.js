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

// These routes must stay on whichever Spotly origin is currently serving the page.
// /login is intentionally local so a subdomain can recover auth without bouncing away.
const ORIGIN_LOCAL_PREFIXES = [
  "/api", "/_next", "/brand", "/lottie", "/icons", "/favicon", "/manifest", "/firebase-messaging-sw.js", "/login"
];

// These are customer/global destinations. On a product subdomain they canonicalize to
// spotlyafrica.com. Portal-specific /support is NOT listed because Business/Driver own
// their own clean /support routes.
const CUSTOMER_HOST_PREFIXES = [
  "/account", "/marketplace", "/privacy", "/terms", "/payment", "/claim", "/drive"
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

function matchesPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function portalDestination(pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const destinationHost = PATH_TO_HOST[firstSegment];
  if (!destinationHost) return null;
  const cleanPath = pathname === `/${firstSegment}` ? "/" : pathname.slice(firstSegment.length + 1) || "/";
  return { firstSegment, destinationHost, cleanPath };
}

export function proxy(request) {
  const host = hostname(request);
  const { pathname } = request.nextUrl;
  const isSpotlyHost = host === "spotlyafrica.com" || host === "www.spotlyafrica.com" || host.endsWith(".spotlyafrica.com");
  if (!isSpotlyHost) return NextResponse.next();

  // Apex and www are both customer hosts. Vercel alone owns the apex/www canonical
  // redirect direction so application code cannot create a redirect loop.
  if (host === "spotlyafrica.com" || host === "www.spotlyafrica.com") {
    if (pathname === "/login") {
      const requestedPortal = request.nextUrl.searchParams.get("portal");
      const loginHost = PATH_TO_HOST[requestedPortal];
      if (loginHost) return NextResponse.redirect(productionUrl(request, loginHost, "/login"), 307);
    }
    const destination = portalDestination(pathname);
    if (destination) return NextResponse.redirect(productionUrl(request, destination.destinationHost, destination.cleanPath), 308);
    return NextResponse.next();
  }

  const portalPrefix = PORTALS[host];
  if (!portalPrefix) return NextResponse.next();

  if (pathname === "/login") {
    const requestedPortal = request.nextUrl.searchParams.get("portal");
    const loginHost = PATH_TO_HOST[requestedPortal];
    if (loginHost && loginHost !== host) return NextResponse.redirect(productionUrl(request, loginHost, "/login"), 307);
  }

  // Any legacy portal-prefixed link is safe from any Spotly subdomain. This catches old
  // links that have not yet been converted to direct product-domain URLs.
  const destination = portalDestination(pathname);
  if (destination) {
    return NextResponse.redirect(productionUrl(request, destination.destinationHost, destination.cleanPath), 308);
  }

  if (matchesPrefix(pathname, CUSTOMER_HOST_PREFIXES)) {
    return NextResponse.redirect(productionUrl(request, "spotlyafrica.com", pathname), 308);
  }

  if (matchesPrefix(pathname, ORIGIN_LOCAL_PREFIXES)) return NextResponse.next();

  // Clean product-domain URLs are internally mapped to the existing Next.js route tree.
  // business.spotlyafrica.com/ -> /business
  // business.spotlyafrica.com/orders -> /business/orders
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? portalPrefix : `${portalPrefix}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|lottie/).*)"]
};
