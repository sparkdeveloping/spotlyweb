"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { BusinessDataProvider, useBusinessWorkspace } from "@/components/business/business-context";
import { LoadingState } from "@/components/business/shared";
import { NoBusinessView } from "@/components/business/no-business";
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

const views = {
  setup: BusinessSetupView,
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

function InvitationBanner() {
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitation") || "";
  const [accepting, setAccepting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  if (!invitationId) return null;

  async function accept() {
    setAccepting(true);
    try {
      await authenticatedFetch("/api/business-invitations/accept", { method: "POST", body: JSON.stringify({ invitationId }) });
      await user.getIdToken(true);
      toast("The invitation has been accepted and the assigned business is ready.", { title: "Access added" });
      window.setTimeout(() => window.location.assign("/business"), 650);
    } catch (error) {
      toast(error.message || "The invitation could not be accepted.", { type: "error", title: "Could not accept invitation" });
    } finally { setAccepting(false); }
  }

  return <Card className="mb-6 flex flex-col gap-4 border-business/25 bg-business-soft p-5 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-business shadow-sm"><CheckCircle2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">A business invited this account</h2><p className="mt-1 text-sm leading-6 text-secondary">Accepting adds only the assigned business, location, and responsibilities. Your existing access will not be replaced.</p></div><Button onClick={accept} loading={accepting}>Accept invitation</Button></Card>;
}

function WorkspaceContent({ section }) {
  const { user } = useAuth();
  const workspace = useBusinessWorkspace();
  if (!workspace.businessIds.length) return <NoBusinessView user={user} />;
  if (workspace.loading && !workspace.business) return <div className="p-4 sm:p-6 lg:p-8"><LoadingState /></div>;
  if (workspace.error && !workspace.business) return <div className="p-4 sm:p-6 lg:p-8"><Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><AlertTriangle className="h-8 w-8 text-danger" /><h1 className="mt-4 text-xl font-semibold">The business workspace could not load</h1><p className="mt-2 max-w-lg text-sm leading-6 text-secondary">{workspace.error}</p><button className="mt-5 font-semibold text-business" onClick={() => window.location.reload()}>Try again</button></Card></div>;
  const View = views[section] || BusinessDashboard;
  return <div className="p-4 sm:p-6 lg:p-8"><InvitationBanner /><View /></div>;
}

function BusinessShell({ section }) {
  const workspace = useBusinessWorkspace();
  const navigation = businessNavigation(workspace.business || {}, workspace.setupComplete, workspace.branches.length);
  const allowed = new Set(navigation.map((item) => item.id));
  const safeSection = allowed.has(section) ? section : workspace.setupComplete ? "dashboard" : "setup";
  return <PortalShell portalId="business" activeSection={safeSection} navigation={navigation} footer={false}><WorkspaceContent section={safeSection} /></PortalShell>;
}

export function BusinessWorkspace({ section = "dashboard" }) {
  return <AuthGate portal="business" title="Sign in to manage your business"><BusinessDataProvider><BusinessShell section={section} /></BusinessDataProvider></AuthGate>;
}
