"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { LoadingState } from "@/components/business/shared";
import { BusinessAccount } from "@/components/business/business-account";
import { BusinessDashboard } from "@/components/business/dashboard";
import { OrdersView } from "@/components/business/orders";
import { CatalogView } from "@/components/business/catalog";
import { BranchesView } from "@/components/business/branches";
import { InsightsView } from "@/components/business/insights";
import { PromotionsView } from "@/components/business/promotions";
import { StaffView } from "@/components/business/staff";
import { FinanceView } from "@/components/business/finance";
import { SupportView } from "@/components/business/support";
import { SettingsView } from "@/components/business/settings";
import { BusinessSetupView } from "@/components/business/setup";
import { KioskView } from "@/components/business/kiosk";
import { DeliveryView } from "@/components/business/delivery";
import { BusinessLaunchView, BusinessLifecycleBanner, LockedBusinessFeature } from "@/components/business/launch";
import { BUSINESS_ACCOUNT_SECTIONS } from "@/lib/business-routing";

const views = {
  launch: BusinessLaunchView,
  setup: BusinessSetupView,
  today: BusinessDashboard,
  dashboard: BusinessDashboard,
  activity: OrdersView,
  catalog: CatalogView,
  branches: BranchesView,
  delivery: DeliveryView,
  kiosk: KioskView,
  insights: InsightsView,
  promotions: PromotionsView,
  staff: StaffView,
  finance: FinanceView,
  support: SupportView,
  settings: SettingsView
};

function sectionAllowed(section, lifecycle) {
  if (lifecycle.navigationMode === "suspended") return ["launch", "support", "settings"].includes(section);
  if (lifecycle.navigationMode === "live") return true;
  if (lifecycle.navigationMode === "access") return ["launch", "support"].includes(section);
  if (lifecycle.navigationMode === "basics") return ["launch", "setup", "support"].includes(section);
  return ["launch", "setup", "catalog", "branches", "staff", "finance", "support", "settings"].includes(section);
}

function WorkspaceContent({ section }) {
  const workspace = useBusinessWorkspace();
  if (workspace.portfolioLoading && !workspace.businessChoices.length) return <div className="p-4 sm:p-6 lg:p-8"><LoadingState /></div>;
  if (!workspace.businessIds.length) return <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8"><Card variant="bordered" className="p-8 text-center"><h1 className="text-2xl font-semibold">Choose a business from your portfolio</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-secondary">Claims and invitations stay in your Business account even before an operating workspace is available.</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Button asChild><Link href="/business">Open portfolio</Link></Button><Button asChild variant="outline"><Link href="/claim">Claim a business</Link></Button></div></Card></div>;
  if (workspace.contextSwitching || (workspace.loading && !workspace.business)) return <div className="p-4 sm:p-6 lg:p-8"><LoadingState label={`Loading ${workspace.businessChoices.find((item) => item.id === workspace.selectedBusinessId)?.name || "business"}…`} /></div>;
  if (workspace.lifecycleError && !workspace.lifecycleAuthoritative) return <div className="p-4 sm:p-6 lg:p-8"><Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><h1 className="mt-4 text-xl font-semibold">Launch status could not be verified</h1><p className="mt-2 max-w-lg text-sm leading-6 text-secondary">{workspace.lifecycleError}</p><p className="mt-2 max-w-lg text-xs leading-5 text-tertiary">Spotly will not guess your setup or launch state when the authoritative lifecycle service is unavailable.</p><Button className="mt-5" onClick={() => workspace.refreshLifecycle(workspace.selectedBusinessId)}>Try again</Button></Card></div>;
  if (workspace.error && !workspace.business) return <div className="p-4 sm:p-6 lg:p-8"><Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><h1 className="mt-4 text-xl font-semibold">The business workspace could not load</h1><p className="mt-2 max-w-lg text-sm leading-6 text-secondary">{workspace.error}</p><Button className="mt-5" onClick={() => window.location.reload()}>Try again</Button></Card></div>;
  const View = views[section] || BusinessLaunchView;
  const allowed = sectionAllowed(section, workspace.lifecycle);
  return <div className="p-4 sm:p-6 lg:p-8">{!allowed ? <LockedBusinessFeature section={section} /> : <>{!["launch", "setup"].includes(section) && <BusinessLifecycleBanner />}<View /></>}</div>;
}

export function BusinessWorkspace({ section = "portfolio" }) {
  if (BUSINESS_ACCOUNT_SECTIONS.has(section)) return <BusinessAccount section={section} />;
  return <WorkspaceContent section={section} />;
}
