"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { Button, Card } from "@/components/ui";
import { BusinessDataProvider, useBusinessWorkspace } from "@/components/business/business-context";
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
import { businessNavigation } from "@/data/business-archetypes";

const ACCOUNT_SECTIONS = new Set(["portfolio", "claims", "invitations", "access"]);
const views = {
  setup: BusinessSetupView,
  today: BusinessDashboard,
  dashboard: BusinessDashboard,
  activity: OrdersView,
  catalog: CatalogView,
  branches: BranchesView,
  kiosk: KioskView,
  insights: InsightsView,
  promotions: PromotionsView,
  staff: StaffView,
  finance: FinanceView,
  support: SupportView,
  settings: SettingsView
};

function WorkspaceContent({ section }) {
  const workspace = useBusinessWorkspace();
  if (workspace.portfolioLoading && !workspace.businessChoices.length) return <div className="p-4 sm:p-6 lg:p-8"><LoadingState /></div>;
  if (!workspace.businessIds.length) return <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8"><Card variant="bordered" className="p-8 text-center"><h1 className="text-2xl font-semibold">Choose a business from your portfolio</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-secondary">Claims and invitations stay in your Business account even before an operating workspace is available.</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Button asChild><Link href="/business">Open portfolio</Link></Button><Button asChild variant="outline"><Link href="/claim">Claim a business</Link></Button></div></Card></div>;
  if (workspace.loading && !workspace.business) return <div className="p-4 sm:p-6 lg:p-8"><LoadingState /></div>;
  if (workspace.error && !workspace.business) return <div className="p-4 sm:p-6 lg:p-8"><Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><h1 className="mt-4 text-xl font-semibold">The business workspace could not load</h1><p className="mt-2 max-w-lg text-sm leading-6 text-secondary">{workspace.error}</p><Button className="mt-5" onClick={() => window.location.reload()}>Try again</Button></Card></div>;
  const View = views[section] || BusinessDashboard;
  return <div className="p-4 sm:p-6 lg:p-8"><View /></div>;
}

function BusinessShell({ section }) {
  const workspace = useBusinessWorkspace();
  const navigation = businessNavigation(workspace.business || {}, workspace.setupComplete, workspace.branches.length, workspace.selectedBusinessId);
  const allowed = new Set(navigation.map((item) => item.id));
  const preferred = workspace.setupComplete ? "today" : "setup";
  const safeSection = allowed.has(section) ? section : preferred;
  return <PortalShell portalId="business" activeSection={safeSection} navigation={navigation} footer={false}><WorkspaceContent section={safeSection} /></PortalShell>;
}

export function BusinessWorkspace({ section = "portfolio" }) {
  if (ACCOUNT_SECTIONS.has(section)) return <BusinessAccount section={section} />;
  return <AuthGate portal="business" title="Sign in to manage your business"><BusinessDataProvider><BusinessShell section={section} /></BusinessDataProvider></AuthGate>;
}
