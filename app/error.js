"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { reportBoundaryIncident } from "@/lib/client-incidents";
import { friendlyBoundaryMessage } from "@/lib/incident-policy.mjs";
import { portalForHostname, spotlyPortalUrl } from "@/lib/spotly-domains";

const copy = friendlyBoundaryMessage();

export default function ErrorPage({ error, reset }) {
  const reported = useRef(null);
  const [reference, setReference] = useState(null);
  const [localCustomerOrigin, setLocalCustomerOrigin] = useState(false);
  useEffect(() => {
    setLocalCustomerOrigin(["localhost", "127.0.0.1"].includes(window.location.hostname) || portalForHostname(window.location.hostname) === "customer");
  }, []);
  useEffect(() => {
    if (reported.current === error) return;
    reported.current = error;
    let active = true;
    setReference(null);
    reportBoundaryIncident(error, "page-boundary").then((ref) => { if (active) setReference(ref); });
    return () => { active = false; };
  }, [error]);

  const supportHref = process.env.NEXT_PUBLIC_SPOTLY_TICKETS_ENABLED === "true"
    ? (reference ? `https://tickets.spotlyafrica.com/?incident=${encodeURIComponent(reference)}` : "https://tickets.spotlyafrica.com/")
    : (localCustomerOrigin ? "/support" : spotlyPortalUrl("customer", "/support"));
  const homeHref = localCustomerOrigin ? "/" : spotlyPortalUrl("customer");

  return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
    <div className="surface w-full max-w-lg rounded-2xl p-7 text-center shadow-elevated sm:p-9" role="alert">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-secondary"><AlertCircle className="h-5 w-5" /></span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-3 text-sm leading-6 text-secondary">{copy.body}</p>
      {reference && <p className="mt-4 text-xs text-secondary">Support reference: <strong className="select-all">{reference}</strong></p>}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{copy.retry}</Button>
        <Button variant="outline" asChild><a href={supportHref}>{copy.support}</a></Button>
      </div>
      <a href={homeHref} className="mt-5 inline-block text-sm text-secondary underline underline-offset-4">Return to Spotly</a>
    </div>
  </main>;
}
