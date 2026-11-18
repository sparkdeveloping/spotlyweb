"use client";

import dynamic from "next/dynamic";
import { useOperationsContext } from "@/components/operations-context";
import { usePlatform, useAuth } from "@/components/firebase-provider";
import { SpotlyPulseLoader } from "@/components/spotly-pulse-loader";
// Do not ship both full customer experiences into the entry chunk.
const MarketplaceApp = dynamic(() => import("@/components/marketplace-app").then((mod) => mod.MarketplaceApp), { loading: () => <PublicHomeLoading /> });
const FirstAccessLanding = dynamic(() => import("@/components/first-access-landing").then((mod) => mod.FirstAccessLanding), { loading: () => <PublicHomeLoading /> });
const MaintenanceLanding = dynamic(() => import("@/components/first-access-landing").then((mod) => mod.MaintenanceLanding), { loading: () => <PublicHomeLoading /> });

function PublicHomeLoading() {
  return <SpotlyPulseLoader label="Opening Spotly home" />;
}

export function PublicHomeRouter() {
  const { settings, settingsReady } = usePlatform();
  const { user } = useAuth();
  const operations = useOperationsContext();
  if (!settingsReady) return <PublicHomeLoading />;
  if (settings.launch?.publicMode === "maintenance") return <MaintenanceLanding />;
  if (["first_access", "coming-soon", "private-beta"].includes(settings.launch?.publicMode)) {
    const previewEnabled = user && !user.isAnonymous && (operations.context.servicePreview || operations.context.serviceOperations);
    if (operations.loading) return <PublicHomeLoading />;
    return previewEnabled ? <MarketplaceApp basePath="/" /> : <FirstAccessLanding />;
  }
  return <MarketplaceApp basePath="/" />;
}
