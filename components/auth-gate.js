"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";
import { BusinessMarketingPage } from "@/components/business/business-marketing";
import { DriverMarketingPage } from "@/components/driver/driver-marketing";
import { normalizePortalPath, spotlyPortalUrl } from "@/lib/spotly-domains";

function currentPortalDestination(portal, pathname, searchParams) {
  const cleanPath = portal === "customer" ? (pathname || "/") : normalizePortalPath(portal, pathname || "/");
  const query = searchParams?.toString?.() || "";
  return `${cleanPath || "/"}${query ? `?${query}` : ""}`;
}

function isBusinessLanding(pathname) {
  return !pathname || pathname === "/" || pathname === "/business" || pathname === "/business/";
}

function isDriverLanding(pathname) {
  return !pathname || pathname === "/" || pathname === "/driver" || pathname === "/driver/";
}

export function AuthGate({ children, portal = "customer", title = "Sign in required" }) {
  const { user, authReady } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = currentPortalDestination(portal, pathname, searchParams);
  const loginHref = `/login?portal=${encodeURIComponent(portal)}&next=${encodeURIComponent(next)}`;

  if (!authReady) return <div className="flex min-h-screen items-center justify-center bg-grouped"><LoaderCircle className={`h-8 w-8 animate-spin ${portal === "business" ? "text-business" : portal === "driver" ? "text-driver" : "text-violet"}`} /></div>;
  if (!user || user.isAnonymous) {
    if (portal === "business" && isBusinessLanding(pathname)) return <BusinessMarketingPage loginHref={loginHref} />;
    if (portal === "driver" && isDriverLanding(pathname)) return <DriverMarketingPage loginHref={loginHref} />;
    const isDriver = portal === "driver";
    return <main data-workspace={portal} className="flex min-h-screen items-center justify-center bg-grouped px-4"><Card elevated className="w-full max-w-md p-7 text-center"><Image src={portal === "business" ? "/brand/spotly-business.svg" : isDriver ? "/brand/spotly-driver.svg" : "/brand/spotly.svg"} alt={isDriver ? "Spotly Driver" : "Spotly"} width={64} height={64} className="mx-auto" /><span className={`mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-xl ${portal === "business" ? "bg-business-soft text-business" : isDriver ? "bg-driver-soft text-driver" : "bg-violet-soft text-violet"}`}><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-semibold">{isDriver ? "Sign in to Spotly Driver" : title}</h1><p className="mt-3 text-sm leading-6 text-secondary">{isDriver ? "Sign in to return to this Driver page. New applicants should start from the Driver homepage, where Spotly explains work types, requirements and onboarding before sign-in." : "Sign in with the Spotly account connected to this workspace. You will return to this exact page after authentication."}</p><Button asChild className="mt-6 w-full"><Link href={loginHref}>{isDriver ? "Sign in to Driver" : "Sign in to continue"}</Link></Button><Link href={portal === "business" ? "/" : isDriver ? spotlyPortalUrl("customer", "/drive") : spotlyPortalUrl("customer")} className="mt-4 block text-sm font-semibold text-secondary">{portal === "business" ? "Learn about Spotly Business" : isDriver ? "Learn about driving with Spotly" : "Return to Spotly"}</Link></Card></main>;
  }
  return children;
}
