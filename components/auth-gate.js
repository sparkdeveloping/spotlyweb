"use client";

import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";

export function AuthGate({ children, portal = "customer", title = "Sign in required" }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <div className="flex min-h-screen items-center justify-center bg-grouped"><LoaderCircle className="h-8 w-8 animate-spin text-violet" /></div>;
  if (!user || user.isAnonymous) return <main className="flex min-h-screen items-center justify-center bg-grouped px-4" style={{ "--accent": "#6657d9", "--accent-soft": "#f0eeff" }}><Card elevated className="w-full max-w-md p-7 text-center"><Image src="/brand/spotly.png" alt="Spotly" width={64} height={64} className="mx-auto rounded-[20px]" /><span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-soft text-violet"><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-secondary">Use your primary Spotly email-and-password account. Other sign-in methods can be linked after account creation.</p><Button asChild className="mt-6 w-full"><Link href={`/login?portal=${portal}`}>Sign in to continue</Link></Button><Link href="/" className="mt-4 block text-sm font-semibold text-secondary">Return to Spotly</Link></Card></main>;
  return children;
}
