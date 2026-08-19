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

function hostname(request) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function productionUrl(request, host) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = host;
  url.port = "";
  return url;
}

export function proxy(request) {
  const host = hostname(request);
  const { pathname } = request.nextUrl;

  // Keep Vercel preview/local hosts untouched so previews remain usable.
  const isSpotlyHost = host === "spotlyafrica.com" || host === "www.spotlyafrica.com" || host.endsWith(".spotlyafrica.com");
  if (!isSpotlyHost) return NextResponse.next();

  if (host === "www.spotlyafrica.com") {
    return NextResponse.redirect(productionUrl(request, "spotlyafrica.com"), 308);
  }

  const portalPrefix = PORTALS[host];
  if (portalPrefix) {
    // Shared routes deliberately remain on the active portal origin so Firebase
    // browser auth, APIs, service workers, and callback flows stay origin-safe.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = portalPrefix;
      return NextResponse.rewrite(url);
    }

    // A portal link copied from the old apex structure still works on its new host.
    if (pathname === portalPrefix || pathname.startsWith(`${portalPrefix}/`)) {
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  if (host === "spotlyafrica.com") {
    const firstSegment = pathname.split("/").filter(Boolean)[0];
    const destinationHost = PATH_TO_HOST[firstSegment];
    if (destinationHost) {
      return NextResponse.redirect(productionUrl(request, destinationHost), 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|lottie/).*)"]
};
