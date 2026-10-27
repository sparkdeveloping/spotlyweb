"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import { FirstAccessLanding, MaintenanceLanding } from "@/components/first-access-landing";
import { Button } from "@/components/ui";
import { usePlatform, useAuth } from "@/components/firebase-provider";
import { MarketplaceApp } from "@/components/marketplace-app";

function PublicHomeLoading() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--text)]" aria-busy="true" aria-label="Opening Spotly">
    <div className="border-b border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:px-8"><div className="v7-skeleton h-9 w-24 rounded-[12px]" /><div className="v7-skeleton hidden h-11 w-[300px] rounded-[12px] lg:block" /><div className="ml-auto flex gap-2"><div className="v7-skeleton hidden h-10 w-24 rounded-[12px] sm:block" /><div className="v7-skeleton h-10 w-10 rounded-[12px]" /><div className="v7-skeleton h-10 w-10 rounded-[12px]" /></div></div></div>
    <main className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-8 sm:px-6 lg:px-8"><div className="max-w-2xl"><div className="v7-skeleton h-4 w-32 rounded-full" /><div className="v7-skeleton mt-4 h-12 w-[72%] max-w-xl rounded-[12px]" /><div className="v7-skeleton mt-3 h-5 w-full max-w-lg rounded-[10px]" /></div><div className="mt-7 grid gap-3 lg:grid-cols-[1.15fr_.85fr]"><div className="v7-skeleton min-h-[292px] rounded-[24px]" /><div className="grid grid-cols-2 gap-3"><div className="v7-skeleton min-h-[154px] rounded-[24px]" /><div className="v7-skeleton min-h-[154px] rounded-[24px]" /><div className="v7-skeleton min-h-[120px] rounded-[24px]" /><div className="v7-skeleton min-h-[120px] rounded-[24px]" /></div></div><div className="mt-10 border-t border-[var(--border-subtle)] pt-7"><div className="v7-skeleton h-7 w-40 rounded-[10px]" /><div className="mt-4 flex gap-4 overflow-hidden">{[0,1,2,3].map((item) => <div key={item} className="shrink-0"><div className="v7-skeleton h-44 w-64 rounded-[16px]" /><div className="v7-skeleton mt-3 h-4 w-36 rounded-full" /></div>)}</div></div></main>
  </div>;
}

function MaintenanceHome() {
  return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4"><div className="w-full max-w-xl rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-8 text-center shadow-card sm:p-10"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--accent-soft)] text-[var(--accent)]"><Wrench className="h-6 w-6" /></span><h1 className="mt-6 text-3xl font-semibold tracking-[-.04em]">Spotly is getting a quick tune-up.</h1><p className="mt-4 text-sm leading-7 text-[var(--text-2)]">Customer access is temporarily paused while we work on the platform. Business, Driver and support access can continue through their direct pages.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/support">Get help</Link></Button><Button asChild variant="outline"><Link href="/account">Open account</Link></Button></div></div></main>;
}

export function PublicHomeRouter() {
  const { settings, settingsReady } = usePlatform();
  const { user, profile } = useAuth();
  if (!settingsReady) return <PublicHomeLoading />;
  if (settings.launch?.publicMode === "maintenance") return <MaintenanceLanding />;
  if (["first_access", "coming-soon", "private-beta"].includes(settings.launch?.publicMode)) {
    const betaEnabled = settings.launch?.privateBetaEnabled !== false && user && !user.isAnonymous && profile?.privateBeta === true;
    return betaEnabled ? <MarketplaceApp basePath="/" /> : <FirstAccessLanding />;
  }
  return <MarketplaceApp basePath="/" />;
}
