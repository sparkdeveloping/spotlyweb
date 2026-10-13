"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button, Card, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";

function OnboardingForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", emergencyContactName: "", emergencyContactPhone: "", workArrangement: "office", acknowledgement: false });
  if (!token) return <EmptyState icon={ShieldCheck} title="Onboarding link required" description="Open the secure link sent by Spotly People Operations. A staff account cannot be created from this page without an invitation." />;
  if (done) return <Card className="mx-auto max-w-2xl p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-success"><CheckCircle2 className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-semibold">Onboarding sent for approval</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-secondary">People Operations will review your submission. Your Spotly Staff access activates only after approval, so no permissions are granted simply by opening this link.</p></Card>;
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try { await authenticatedFetch("/api/staff/invitations", { method: "POST", body: JSON.stringify({ action: "submit_onboarding", token, ...form }) }); setDone(true); }
    catch (error) { toast(error.message, { type: "error", title: "Onboarding could not be submitted" }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageHeader eyebrow="Spotly Staff" title="Complete your onboarding" description="Confirm the essential information Spotly needs for work, support and emergencies. Your assigned role is reviewed separately before access activates." /><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><SectionCard padded title="Your details"><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Full legal name<input required className="field-control mt-2 w-full" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label className="text-sm font-semibold">Phone<input required className="field-control mt-2 w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263 …" /></label><label className="text-sm font-semibold">Work arrangement<select className="field-control mt-2 w-full" value={form.workArrangement} onChange={(e) => setForm({ ...form, workArrangement: e.target.value })}><option value="office">Office</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option><option value="field">Field</option></select></label><label className="text-sm font-semibold">Emergency contact name<input required className="field-control mt-2 w-full" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /></label><label className="text-sm font-semibold">Emergency contact phone<input required className="field-control mt-2 w-full" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+263 …" /></label></div><label className="flex items-start gap-3 rounded-xl bg-grouped p-4 text-sm"><input required type="checkbox" className="mt-1" checked={form.acknowledgement} onChange={(e) => setForm({ ...form, acknowledgement: e.target.checked })} /><span>I confirm these details are accurate and understand Spotly will use them for employment administration, access, safety and support.</span></label><Button type="submit" loading={busy} disabled={!form.acknowledgement}><UserCheck className="h-4 w-4" />Send for approval</Button></form></SectionCard><Card className="p-5"><ShieldCheck className="h-6 w-6 text-[var(--accent)]" /><h2 className="mt-4 font-semibold">What happens next</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-secondary"><li>1. You submit these details.</li><li>2. An authorized Spotly reviewer checks your role and onboarding.</li><li>3. Only after approval does your Staff workspace activate.</li><li>4. Your required training and equipment then appear automatically.</li></ol></Card></div></div>;
}

export function StaffOnboarding() {
  return <AuthGate portal="staff" title="Sign in to complete Spotly Staff onboarding"><main data-workspace="staff" className="min-h-screen bg-[var(--background)] text-[var(--text)]"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><OnboardingForm /></div></main></AuthGate>;
}
