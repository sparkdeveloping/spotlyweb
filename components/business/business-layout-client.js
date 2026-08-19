"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { BusinessDataProvider, useBusinessWorkspace } from "@/components/business/business-context";
import { businessAccountNavigation } from "@/components/business/business-account";
import { businessNavigation } from "@/data/business-archetypes";
import { businessSectionFromPath, isBusinessAccountSection } from "@/lib/business-routing";

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

  if (pathname.startsWith("/business/kiosk/live")) return children;
  return <PortalShell portalId="business" activeSection={section} navigation={stableNavigation} footer={false} notificationBusinessId={accountLevel ? null : workspace.selectedBusinessId}>{children}</PortalShell>;
}

export function BusinessLayoutClient({ children }) {
  const pathname = usePathname();
  // The live kiosk authenticates with its own revocable device credential. It must not inherit
  // the Business owner's Firebase session or BusinessDataProvider just because its URL lives
  // under /business. This is what makes a shared tablet genuinely safe and independent.
  if (pathname.startsWith("/business/kiosk/live")) return children;
  return <AuthGate portal="business" title="Sign in to manage your businesses"><BusinessDataProvider><BusinessPortalFrame>{children}</BusinessPortalFrame></BusinessDataProvider></AuthGate>;
}
