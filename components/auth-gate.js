"use client";

import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export function AuthGate({ children, portal = "customer", title = "Sign in required" }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <div className="flex min-h-screen items-center justify-center bg-grouped"><LoaderCircle className="h-8 w-8 animate-spin text-violet" /></div>;
  if (!user || user.isAnonymous) return <main className="flex min-h-screen items-center justify-center bg-grouped px-4"><Card elevated className="w-full max-w-md p-7 text-center"><Image src="/brand/spotly.svg" alt="Spotly" width={64} height={64} className="mx-auto" /><span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-soft text-violet"><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-secondary">Sign in with the Spotly account connected to this workspace.</p><Button asChild className="mt-6 w-full"><Link href={`/login?portal=${portal}`}>Sign in to continue</Link></Button><Link href={spotlyPortalUrl("customer")} className="mt-4 block text-sm font-semibold text-secondary">Return to Spotly</Link></Card></main>;
  return children;
}
