"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui";
import { usePlatform } from "@/components/firebase-provider";
import { ComingSoonApp } from "@/components/coming-soon-app";

function PublicHomeLoading() {
  return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4"><div className="text-center"><Image src="/brand/spotly.svg" alt="" width={56} height={56} className="mx-auto h-14 w-14" priority /><LoaderCircle className="mx-auto mt-5 h-5 w-5 animate-spin text-violet" /><p className="mt-3 text-sm text-secondary">Loading Spotly…</p></div></main>;
}

function MaintenanceHome() {
  return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4"><div className="w-full max-w-xl rounded-[24px] border bg-[var(--surface)] p-8 text-center shadow-card sm:p-10"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-violet-soft text-violet"><Wrench className="h-6 w-6" /></span><h1 className="mt-6 text-3xl font-semibold tracking-[-.04em]">Spotly is getting a quick tune-up.</h1><p className="mt-4 text-sm leading-7 text-secondary">Customer access is temporarily paused while we work on the platform. Business, Driver and support access can continue through their direct pages where available.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/support">Get help</Link></Button><Button asChild variant="outline"><Link href="/account">Open account</Link></Button></div></div></main>;
}

export function PublicHomeRouter() {
  const { settings, settingsReady } = usePlatform();
  const router = useRouter();
  const mode = settings.launch?.publicMode || "coming-soon";
  const marketplaceEnabled = settings.launch?.marketplaceEnabled === true;

  useEffect(() => {
    if (!settingsReady) return;
    if (mode === "marketplace" && marketplaceEnabled) router.replace("/marketplace");
  }, [marketplaceEnabled, mode, router, settingsReady]);

  if (!settingsReady) return <PublicHomeLoading />;
  if (mode === "marketplace" && marketplaceEnabled) return <PublicHomeLoading />;
  if (mode === "maintenance") return <MaintenanceHome />;
  return <ComingSoonApp variant={mode === "private-beta" ? "private-beta" : "launch"} />;
}
