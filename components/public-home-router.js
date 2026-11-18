"use client";

import dynamic from "next/dynamic";
import { useOperationsContext } from "@/components/operations-context";
import { usePlatform, useAuth } from "@/components/firebase-provider";
// Do not ship both full customer experiences into the entry chunk.
const MarketplaceApp = dynamic(() => import("@/components/marketplace-app").then((mod) => mod.MarketplaceApp), { loading: () => <PublicHomeLoading /> });
const FirstAccessLanding = dynamic(() => import("@/components/first-access-landing").then((mod) => mod.FirstAccessLanding), { loading: () => <PublicHomeLoading /> });
const MaintenanceLanding = dynamic(() => import("@/components/first-access-landing").then((mod) => mod.MaintenanceLanding), { loading: () => <PublicHomeLoading /> });

function PublicHomeLoading() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--text)]" aria-busy="true" aria-label="Opening Spotly">
    <div className="border-b border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:px-8"><div className="v7-skeleton h-9 w-24 rounded-[12px]" /><div className="v7-skeleton hidden h-11 w-[300px] rounded-[12px] lg:block" /><div className="ml-auto flex gap-2"><div className="v7-skeleton hidden h-10 w-24 rounded-[12px] sm:block" /><div className="v7-skeleton h-10 w-10 rounded-[12px]" /><div className="v7-skeleton h-10 w-10 rounded-[12px]" /></div></div></div>
    <main className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-8 sm:px-6 lg:px-8"><p className="mb-5 text-sm text-[var(--text-2)]" role="status" aria-live="polite">Opening Spotly…</p><div className="max-w-2xl"><div className="v7-skeleton h-4 w-32 rounded-full" /><div className="v7-skeleton mt-4 h-12 w-[72%] max-w-xl rounded-[12px]" /><div className="v7-skeleton mt-3 h-5 w-full max-w-lg rounded-[10px]" /></div><div className="mt-7 grid gap-3 lg:grid-cols-[1.15fr_.85fr]"><div className="v7-skeleton min-h-[292px] rounded-[24px]" /><div className="grid grid-cols-2 gap-3"><div className="v7-skeleton min-h-[154px] rounded-[24px]" /><div className="v7-skeleton min-h-[154px] rounded-[24px]" /><div className="v7-skeleton min-h-[120px] rounded-[24px]" /><div className="v7-skeleton min-h-[120px] rounded-[24px]" /></div></div><div className="mt-10 border-t border-[var(--border-subtle)] pt-7"><div className="v7-skeleton h-7 w-40 rounded-[10px]" /><div className="mt-4 flex gap-4 overflow-hidden">{[0,1,2,3].map((item) => <div key={item} className="shrink-0"><div className="v7-skeleton h-44 w-64 rounded-[16px]" /><div className="v7-skeleton mt-3 h-4 w-36 rounded-full" /></div>)}</div></div></main>
  </div>;
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
