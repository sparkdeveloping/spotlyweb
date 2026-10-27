"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { FirstAccessLanding, MaintenanceLanding } from "@/components/first-access-landing";

// This is a customer UX gate, not an authentication substitute. Commerce mutation
// handlers must separately enforce the same rollout policy on the server.
const gatedPrefixes = [
  "/marketplace", "/bite", "/shopper", "/ride", "/send", "/book", "/live",
  "/search", "/place", "/item", "/order", "/saved", "/activity",
  "/shop-for-me", "/assist", "/notifications", "/referrals"
];
function isCustomerHost() {
  const name = window.location.hostname.toLowerCase();
  return name === "spotlyafrica.com" || name === "www.spotlyafrica.com" || name === "localhost" || name === "127.0.0.1";
}
export function CustomerLaunchGate({ children }) {
  const path = usePathname() || "/";
  const requiresGate = gatedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const [customerHost, setCustomerHost] = useState(null);
  const { profile, user } = useAuth();
  const { settings, settingsReady } = usePlatform();
  useEffect(() => setCustomerHost(isCustomerHost()), []);
  if (!requiresGate) return children;
  if (customerHost === null || !settingsReady) return <div className="min-h-screen bg-[var(--background)]" aria-busy="true" />;
  if (!customerHost) return children;
  const mode = settings?.launch?.publicMode;
  if (mode === "maintenance") return <MaintenanceLanding />;
  if (["first_access", "coming-soon", "private-beta"].includes(mode)) {
    const invited = settings?.launch?.privateBetaEnabled !== false && Boolean(user && !user.isAnonymous && profile?.privateBeta === true);
    if (!invited) return <FirstAccessLanding />;
  }
  return children;
}
