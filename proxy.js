import { NextResponse } from "next/server";
import { PORTAL_LOCAL_SECTIONS } from "./lib/spotly-domains.js";

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

// Clean product-domain paths are intentionally allowed to use words that are also
// product names. Keep this list centralized with client navigation resolution so
// Business /staff cannot mean one thing in the browser and another at the edge.
const PRODUCT_LOCAL_SECTIONS = Object.fromEntries(
  Object.entries(PORTAL_LOCAL_SECTIONS).filter(([portal]) => portal !== "customer").map(([portal, sections]) => {
    const host = Object.entries(PORTALS).find(([, prefix]) => prefix === `/${portal}`)?.[0];
    return [host, sections];
  }).filter(([host]) => Boolean(host))
);

// These routes must stay on whichever Spotly origin is currently serving the page.
// /login is intentionally local so a subdomain can recover auth without bouncing away.
const ORIGIN_LOCAL_PREFIXES = [
  "/api", "/_next", "/brand", "/lottie", "/icons", "/favicon", "/manifest", "/firebase-messaging-sw.js", "/apple-touch-icon.png"
];

// Customer/global destinations always live on the customer origin. Portal-specific
// /support is intentionally not listed because Business and Driver own clean /support routes.
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

function localSection(host, pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return Boolean(firstSegment && PRODUCT_LOCAL_SECTIONS[host]?.has(firstSegment));
}

function portalNameForHost(host) {
  const prefix = PORTALS[host];
  return prefix ? prefix.slice(1) : "";
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
  const currentPortal = portalNameForHost(host);

  // Direct /login on a product domain should always know which product the user asked
  // for. This keeps styling and post-login return behavior correct even when the URL was
  // typed manually rather than reached through AuthGate.
  if (pathname === "/login") {
    const requestedPortal = request.nextUrl.searchParams.get("portal");
    const loginHost = PATH_TO_HOST[requestedPortal];
    if (loginHost && loginHost !== host) return NextResponse.redirect(productionUrl(request, loginHost, "/login"), 307);
    if (!requestedPortal) {
      const url = request.nextUrl.clone();
      url.searchParams.set("portal", currentPortal);
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  // Product workspaces are private application surfaces. Give every dedicated hostname
  // its own crawler policy instead of accidentally serving the customer-site robots rules.
  if (pathname === "/robots.txt") {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace-robots.txt";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/sitemap.xml") return NextResponse.redirect(productionUrl(request, "spotlyafrica.com", "/sitemap.xml"), 308);

  // Assets and APIs are origin-local. Check them before product-path interpretation.
  if (matchesPrefix(pathname, ORIGIN_LOCAL_PREFIXES)) return NextResponse.next();

  const destination = portalDestination(pathname);
  if (destination) {
    // A prefixed path for the CURRENT portal is always a legacy URL and is cleaned.
    if (destination.firstSegment === currentPortal) {
      return NextResponse.redirect(productionUrl(request, host, destination.cleanPath), 308);
    }
    // Other product names are only interpreted as cross-product legacy URLs when they
    // are not a valid clean section of the current product. This prevents Business /staff
    // from incorrectly jumping to Spotly Staff.
    if (!localSection(host, pathname)) {
      return NextResponse.redirect(productionUrl(request, destination.destinationHost, destination.cleanPath), 308);
    }
  }

  // Business and Driver own a workspace-local /support experience. Staff uses /help and
  // Admin has no local support route, so an accidental /support there belongs to the
  // customer/global support surface instead of rewriting into a 404.
  if (pathname === "/support" && !["business", "driver"].includes(currentPortal)) {
    return NextResponse.redirect(productionUrl(request, "spotlyafrica.com", pathname), 308);
  }

  if (matchesPrefix(pathname, CUSTOMER_HOST_PREFIXES)) {
    return NextResponse.redirect(productionUrl(request, "spotlyafrica.com", pathname), 308);
  }

  // Clean product-domain URLs are internally mapped to the existing Next.js route tree.
  // business.spotlyafrica.com/ -> /business
  // business.spotlyafrica.com/activity -> /business/activity
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? portalPrefix : `${portalPrefix}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|lottie/).*)"]
};
