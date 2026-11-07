"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { Card, Button } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/components/firebase-provider";

function Claim() {
  const searchParams = useSearchParams();
  const { user, authReady } = useAuth();
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const attempted = useRef("");
  const token = searchParams?.get("token") || "";
  useEffect(() => {
    if (!authReady || !user?.uid || user.isAnonymous || !token) return;
    const key = `${user.uid}:${token}`;
    if (attempted.current === key) return;
    attempted.current = key;
    authenticatedFetch("/api/driver/claim-lead", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => { setStatus("claimed"); window.location.replace("/"); })
      .catch((err) => { setError(err.message); setStatus("failed"); });
  }, [authReady, user?.uid, user?.isAnonymous, token]);
  return <main data-workspace="driver" className="flex min-h-screen items-center justify-center bg-grouped px-4"><Card elevated className="w-full max-w-lg p-7">
    <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Spotly Driver · Invitation</p>
    <h1 className="mt-3 text-2xl font-semibold">Pick up where Spotly left off</h1>
    <p className="mt-3 text-sm leading-6 text-secondary">A Spotly team member has started your Driver profile. Your information is saved. Only you can confirm the Driver terms and complete the remaining setup.</p>
    {!token ? <p className="mt-5 text-sm text-danger">This invitation link is missing its private code. Request a new link from Spotly.</p> : status === "claimed" ? <p className="mt-5 text-sm font-semibold">Profile connected. Opening your setup…</p> : status === "failed" ? <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><p className="font-semibold">We could not connect the profile</p><p className="mt-2 text-secondary">{error}</p><p className="mt-3 text-secondary">Use the same verified email address or verified phone number given to the Spotly officer. Do not share this private link publicly.</p></div> : <p className="mt-5 text-sm text-secondary">Checking your verified sign-in and connecting your saved profile…</p>}
    <div className="mt-6 flex gap-3"><Button asChild variant="outline"><Link href="/">Driver home</Link></Button><Button asChild variant="outline"><Link href="/support">Get help</Link></Button></div>
  </Card></main>;
}
export function DriverCompleteInvitation() { return <AuthGate portal="driver" title="Finish your Driver setup"><Claim /></AuthGate>; }
