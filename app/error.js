"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4"><div className="surface max-w-lg rounded-xl p-8 text-center shadow-elevated"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--danger-soft)] text-[var(--on-danger-soft)]"><AlertTriangle className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-bold">Spotly hit an unexpected error.</h1><p className="mt-3 text-sm leading-6 text-secondary">Your data was not intentionally changed. Retry the current screen, or return to the main workspace.</p><div className="mt-6 flex justify-center gap-2"><Button variant="outline" onClick={() => { window.location.href = "/"; }}>Go home</Button><Button onClick={reset}>Try again</Button></div></div></main>;
}
