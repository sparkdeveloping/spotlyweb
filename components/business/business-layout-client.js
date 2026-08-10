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
  return <PortalShell portalId="business" activeSection={section} navigation={stableNavigation} footer={false}>{children}</PortalShell>;
}

export function BusinessLayoutClient({ children }) {
  return <AuthGate portal="business" title="Sign in to manage your businesses"><BusinessDataProvider><BusinessPortalFrame>{children}</BusinessPortalFrame></BusinessDataProvider></AuthGate>;
}
