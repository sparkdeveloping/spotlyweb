"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { BusinessDataProvider, useBusinessWorkspace } from "@/components/business/business-context";
import { businessAccountNavigation } from "@/components/business/business-account";
import { businessNavigation } from "@/data/business-archetypes";
import { businessSectionFromPath, isBusinessAccountSection, isBusinessKioskLivePath } from "@/lib/business-routing";
import { normalizePortalPath } from "@/lib/spotly-domains";

function BusinessPortalFrame({ children }) {
  const pathname = usePathname();
  const workspace = useBusinessWorkspace();
  const section = businessSectionFromPath(pathname);
  const accountLevel = isBusinessAccountSection(section);
  const computedNavigation = useMemo(() => accountLevel
    ? businessAccountNavigation
    : businessNavigation(workspace.business || workspace.businessChoices.find((item) => item.id === workspace.selectedBusinessId) || {}, workspace.lifecycle, workspace.branches.length, workspace.selectedBusinessId),
  [accountLevel, workspace.branches.length, workspace.business, workspace.businessChoices, workspace.lifecycle, workspace.selectedBusinessId]);
  const [stableNavigation, setStableNavigation] = useState(computedNavigation);

  useEffect(() => {
    if (accountLevel || !workspace.contextSwitching) setStableNavigation(computedNavigation);
  }, [accountLevel, computedNavigation, workspace.contextSwitching]);

  if (isBusinessKioskLivePath(pathname)) return children;
  return <PortalShell portalId="business" activeSection={section} navigation={stableNavigation} footer={false} notificationBusinessId={accountLevel ? null : workspace.selectedBusinessId}>{children}</PortalShell>;
}

export function BusinessLayoutClient({ children }) {
  const pathname = usePathname();
  const cleanPathname = normalizePortalPath("business", pathname || "/");
  // The live kiosk authenticates with its own revocable device credential. It must not inherit
  // the Business owner's Firebase session or BusinessDataProvider just because its URL lives
  // under /business. This is what makes a shared tablet genuinely safe and independent.
  if (isBusinessKioskLivePath(cleanPathname)) return children;
  // On business.spotlyafrica.com, usePathname() exposes the clean public URL (/get-started),
  // while legacy/internal routes may still include /business. Normalize once so the acquisition
  // journey is never mistaken for a protected workspace page.
  if (cleanPathname === "/get-started" || cleanPathname === "/get-started/") return children;
  if (cleanPathname?.startsWith("/claim-status/")) return <AuthGate portal="business" title="Sign in to track your business verification">{children}</AuthGate>;
  return <AuthGate portal="business" title="Sign in to manage your businesses"><BusinessDataProvider><BusinessPortalFrame>{children}</BusinessPortalFrame></BusinessDataProvider></AuthGate>;
}
