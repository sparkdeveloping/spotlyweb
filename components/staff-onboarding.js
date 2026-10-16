"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  IdCard,
  Laptop,
  ShieldCheck,
  UserCheck,
  UsersRound
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Badge, Button, Card, EmptyState, ProgressBar, SectionCard } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";

const steps = [
  { id: "identity", label: "Your details", icon: IdCard },
  { id: "work", label: "Your work", icon: BriefcaseBusiness },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "first-day", label: "First day", icon: ClipboardCheck }
];

const initialForm = {
  fullName: "",
  preferredName: "",
  phone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  workArrangement: "office",
  firstDayNotes: "",
  policyAcknowledgements: { codeOfConduct: false, dataProtection: false, acceptableUse: false },
  acknowledgement: false
};

function dateLabel(value) {
  if (!value) return "To be confirmed";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZW", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function ContextCard({ icon: Icon, label, value }) {
  return <div className="rounded-xl border bg-[var(--surface)] p-4"><Icon className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-bold uppercase tracking-[.12em] text-tertiary">{label}</p><p className="mt-1 font-semibold">{value || "To be confirmed"}</p></div>;
}

function ChecklistRow({ done = true, children }) {
  return <div className="flex items-start gap-3 rounded-xl bg-grouped p-3 text-sm leading-6"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-[var(--success-soft)] text-success" : "bg-[var(--surface-2)] text-tertiary"}`}>{done && <Check className="h-3.5 w-3.5" />}</span><span>{children}</span></div>;
}

function OnboardingForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    authenticatedFetch(`/api/staff/invitations?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((result) => {
        if (!active) return;
        const invite = result.invitation;
        setInvitation(invite);
        setForm((current) => ({
          ...current,
          fullName: invite.onboarding?.fullName || invite.fullName || "",
          preferredName: invite.onboarding?.preferredName || "",
          phone: invite.onboarding?.phone || "",
          emergencyContactName: invite.onboarding?.emergencyContactName || "",
          emergencyContactPhone: invite.onboarding?.emergencyContactPhone || "",
          emergencyContactRelationship: invite.onboarding?.emergencyContactRelationship || "",
          workArrangement: invite.onboarding?.workArrangement || "office",
          firstDayNotes: invite.onboarding?.firstDayNotes || ""
        }));
      })
      .catch((reason) => active && setError(reason.message || "This onboarding link could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  const progress = Math.round(((step + 1) / steps.length) * 100);
  const policiesComplete = useMemo(() => Object.values(form.policyAcknowledgements).every(Boolean), [form.policyAcknowledgements]);

  function patch(values) { setForm((current) => ({ ...current, ...values })); }
  function patchPolicy(key, value) { setForm((current) => ({ ...current, policyAcknowledgements: { ...current.policyAcknowledgements, [key]: value } })); }

  function validateCurrentStep() {
    if (step === 0 && (!form.fullName.trim() || form.phone.trim().length < 5 || !form.emergencyContactName.trim() || form.emergencyContactPhone.trim().length < 5)) {
      toast("Complete your name, phone, and emergency contact before continuing.", { type: "error", title: "Details still needed" });
      return false;
    }
    if (step === 2 && !policiesComplete) {
      toast("Acknowledge each required workplace policy before continuing.", { type: "error", title: "Policy acknowledgement required" });
      return false;
    }
    return true;
  }

  function next() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event) {
    event.preventDefault();
    if (!policiesComplete) return;
    setBusy(true);
    try {
      await authenticatedFetch("/api/staff/invitations", {
        method: "POST",
        body: JSON.stringify({ action: "submit_onboarding", token, ...form, acknowledgement: true })
      });
      setDone(true);
    } catch (reason) {
      toast(reason.message, { type: "error", title: "Onboarding could not be submitted" });
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <EmptyState icon={ShieldCheck} title="Onboarding link required" description="Open the secure link sent by Spotly People Operations. A staff account cannot be created from this page without an invitation." />;
  if (loading) return <div className="space-y-5"><div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-2)]" /><div className="h-96 animate-pulse rounded-2xl bg-[var(--surface-2)]" /></div>;
  if (error) return <Card className="mx-auto max-w-2xl p-8"><EmptyState icon={ShieldCheck} title="Onboarding link unavailable" description={error} /></Card>;
  if (done) return <Card className="mx-auto max-w-2xl p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-success"><CheckCircle2 className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-semibold">Your onboarding is with People Operations</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-secondary">Your details, policy acknowledgements, work setup and first-day preparation were submitted. Staff access activates after an authorized reviewer approves the same onboarding record.</p><div className="mx-auto mt-6 max-w-md rounded-xl bg-grouped p-4 text-left text-sm"><p className="font-semibold">What happens now</p><p className="mt-2 text-secondary">People Operations reviews your submission, confirms your role and manager, then activates your Staff profile. Required learning and issued equipment will appear in Staff.</p></div></Card>;

  return <div className="space-y-6">
    <div className="border-b pb-6"><Badge tone="accent">Spotly Staff onboarding</Badge><h1 className="mt-4 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Get ready for your first day.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">This setup connects your signed-in account to the role Spotly hired you for. You can see what has already been assigned and exactly what still needs your input.</p>{invitation?.status === "changes_requested" && <div className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm"><p className="font-semibold">People Operations requested changes</p><p className="mt-1 text-[var(--on-warning-soft)]">{invitation.reviewNote || "Review your details and submit again."}</p></div>}</div>

    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="space-y-4">
        <Card className="p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-tertiary">Progress</p><div className="mt-3"><ProgressBar value={progress} label={`${progress}% complete`} /></div></Card>
        <nav className="space-y-2" aria-label="Onboarding steps">{steps.map(({ label, icon: Icon }, index) => <button key={label} type="button" onClick={() => index <= step && setStep(index)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition ${index === step ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : index < step ? "bg-[var(--surface)]" : "cursor-default bg-grouped text-tertiary"}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--background)]"><Icon className="h-4 w-4" /></span><span>{index + 1}. {label}</span>{index < step && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}</button>)}</nav>
      </aside>

      <form onSubmit={submit} className="space-y-5">
        {step === 0 && <SectionCard padded title="Personal and emergency details" description="Only information needed for employment administration, safety and support."><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Full legal name<input required className="field-control mt-2 w-full" value={form.fullName} onChange={(event) => patch({ fullName: event.target.value })} autoComplete="name" /></label><label className="text-sm font-semibold">Preferred name <span className="font-normal text-tertiary">Optional</span><input className="field-control mt-2 w-full" value={form.preferredName} onChange={(event) => patch({ preferredName: event.target.value })} /></label><label className="text-sm font-semibold">Phone<input required className="field-control mt-2 w-full" value={form.phone} onChange={(event) => patch({ phone: event.target.value })} placeholder="+263 …" autoComplete="tel" /></label><label className="text-sm font-semibold">Emergency contact name<input required className="field-control mt-2 w-full" value={form.emergencyContactName} onChange={(event) => patch({ emergencyContactName: event.target.value })} /></label><label className="text-sm font-semibold">Emergency contact phone<input required className="field-control mt-2 w-full" value={form.emergencyContactPhone} onChange={(event) => patch({ emergencyContactPhone: event.target.value })} placeholder="+263 …" /></label><label className="text-sm font-semibold sm:col-span-2">Relationship <span className="font-normal text-tertiary">Optional</span><input className="field-control mt-2 w-full" value={form.emergencyContactRelationship} onChange={(event) => patch({ emergencyContactRelationship: event.target.value })} placeholder="For example: parent, spouse, sibling, friend" /></label></div></SectionCard>}

        {step === 1 && <div className="space-y-5"><SectionCard padded title="Your Spotly work setup" description="These details come from the hiring decision. Contact People Operations if something is wrong."><div className="grid gap-3 sm:grid-cols-2"><ContextCard icon={IdCard} label="Signed-in account" value={invitation.email} /><ContextCard icon={BriefcaseBusiness} label="Role" value={invitation.roleTitle} /><ContextCard icon={UsersRound} label="Department" value={invitation.department} /><ContextCard icon={UserCheck} label="Manager" value={invitation.managerName} /><ContextCard icon={CalendarDays} label="Start date" value={dateLabel(invitation.startDate)} /><ContextCard icon={BriefcaseBusiness} label="Employment" value={invitation.employmentType} /></div></SectionCard><SectionCard padded title="Working arrangement"><label className="text-sm font-semibold">How this role will normally be worked<select className="field-control mt-2 w-full" value={form.workArrangement} onChange={(event) => patch({ workArrangement: event.target.value })}><option value="office">Office</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option><option value="field">Field / mobile</option></select></label><p className="mt-3 text-xs leading-5 text-tertiary">This confirms the expected arrangement for People Operations. Your manager can still assign specific shifts or locations.</p></SectionCard></div>}

        {step === 2 && <SectionCard padded title="Required policy acknowledgements" description="You are acknowledging the workplace rules that govern your access and responsibilities."><div className="space-y-3">{[
          ["codeOfConduct", "Code of conduct", "I understand Spotly expects respectful, lawful and professional conduct while representing the company."],
          ["dataProtection", "Data protection and confidentiality", "I will protect customer, business, driver, applicant and staff information and only use it for authorized work."],
          ["acceptableUse", "Systems and equipment use", "I will use Spotly accounts, systems and issued equipment only for authorized work and follow security requirements."]
        ].map(([key, title, body]) => <label key={key} className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.policyAcknowledgements[key]} onChange={(event) => patchPolicy(key, event.target.checked)} /><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{body}</span></span></label>)}</div></SectionCard>}

        {step === 3 && <div className="space-y-5"><SectionCard padded title="First-day checklist" description="You do not need to chase internal systems to know what is expected."><div className="grid gap-3 sm:grid-cols-2"><ChecklistRow>Account: you are signed in with <strong>{invitation.email}</strong>.</ChecklistRow><ChecklistRow>Role: {invitation.roleTitle} in {invitation.department}.</ChecklistRow><ChecklistRow done={Boolean(invitation.managerName && invitation.managerName !== "To be confirmed")}>Manager: {invitation.managerName || "People Operations will confirm this."}</ChecklistRow><ChecklistRow done={Boolean(invitation.startDate)}>Start date: {dateLabel(invitation.startDate)}.</ChecklistRow></div></SectionCard><div className="grid gap-5 md:grid-cols-2"><SectionCard padded title="Equipment expected"><Laptop className="h-5 w-5 text-[var(--accent)]" /><div className="mt-4 space-y-2">{invitation.equipment?.length ? invitation.equipment.map((item) => <ChecklistRow key={item}>{item}</ChecklistRow>) : <p className="text-sm text-secondary">No standard equipment has been assigned to this role yet.</p>}</div></SectionCard><SectionCard padded title="Required learning"><GraduationCap className="h-5 w-5 text-[var(--accent)]" /><div className="mt-4 space-y-2">{invitation.training?.length ? invitation.training.map((item) => <ChecklistRow key={item}>{item}</ChecklistRow>) : <p className="text-sm text-secondary">No role training has been assigned yet.</p>}</div></SectionCard></div><SectionCard padded title="Anything People Operations should know before day one?" description="Optional. Use this for a practical setup issue, not sensitive medical detail."><textarea className="field-control min-h-28 w-full" value={form.firstDayNotes} onChange={(event) => patch({ firstDayNotes: event.target.value })} placeholder="For example: I need clarification on the office location or start time." /></SectionCard><label className="flex items-start gap-3 rounded-xl bg-grouped p-4 text-sm leading-6"><input required type="checkbox" className="mt-1 h-4 w-4" checked={form.acknowledgement} onChange={(event) => patch({ acknowledgement: event.target.checked })} /><span>I confirm the information I provided is accurate and I understand Spotly will use it for employment administration, access, safety and support.</span></label></div>}

        <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-3 shadow-card backdrop-blur-xl"><Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft className="h-4 w-4" />Back</Button>{step < steps.length - 1 ? <Button type="button" onClick={next}>Continue<ArrowRight className="h-4 w-4" /></Button> : <Button type="submit" loading={busy} disabled={!form.acknowledgement || !policiesComplete}><UserCheck className="h-4 w-4" />Send for approval</Button>}</div>
      </form>
    </div>
  </div>;
}

export function StaffOnboarding() {
  return <AuthGate portal="staff" title="Sign in to complete Spotly Staff onboarding"><main data-workspace="staff" className="min-h-screen bg-[var(--background)] text-[var(--text)]"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12"><OnboardingForm /></div></main></AuthGate>;
}
