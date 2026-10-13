"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, Link2, RefreshCw, Send, UserCheck, UserPlus } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { STAFF_DEPARTMENTS, STAFF_EMPLOYMENT_TYPES, STAFF_ROLE_PACKS, staffDisplayName } from "@/data/staff";
import { Badge, Button, Card, EmptyState, EntityPicker, Modal, SectionCard, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/providers";

const inputClass = "field-control w-full";

export function StaffInvitations({ data }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [generated, setGenerated] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [form, setForm] = useState({ email: "", fullName: "", rolePackId: "support_agent", department: STAFF_ROLE_PACKS.support_agent.department, employmentType: "Permanent", managerId: "", startDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await authenticatedFetch("/api/staff/invitations", { cache: "no-store" }); setItems(result.invitations || []); }
    catch (error) { toast(error.message, { type: "error", title: "Onboarding invitations could not load" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const managerOptions = useMemo(() => (data.directory || []).filter((person) => STAFF_ROLE_PACKS[person.rolePackId]?.managerView).map((person) => ({ value: person.userId || person.id, label: staffDisplayName(person), description: [person.roleTitle, person.department, person.email].filter(Boolean).join(" · ") })), [data.directory]);

  async function create(event) {
    event.preventDefault();
    setBusy("create");
    try {
      const result = await authenticatedFetch("/api/staff/invitations", { method: "POST", body: JSON.stringify({ action: "create", ...form }) });
      setGenerated(result.onboardingUrl);
      toast("A secure onboarding link was created. Share it only with the intended staff member.", { title: "Onboarding link ready" });
      await load();
    } catch (error) { toast(error.message, { type: "error", title: "Invitation could not be created" }); }
    finally { setBusy(""); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(generated);
    toast("Onboarding link copied.", { title: "Copied" });
  }

  async function decide(action) {
    if (!reviewing) return;
    setBusy(action);
    try {
      await authenticatedFetch("/api/staff/invitations", { method: "POST", body: JSON.stringify({ action, invitationId: reviewing.id, note: reviewNote }) });
      toast(action === "approve" ? "The staff account is approved and can now use Spotly Staff." : action === "request_changes" ? "The invitee can correct and resubmit onboarding." : "The invitation was revoked.", { title: "Onboarding updated" });
      setReviewing(null); setReviewNote(""); await load();
    } catch (error) { toast(error.message, { type: "error", title: "Onboarding could not be updated" }); }
    finally { setBusy(""); }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Staff onboarding</h2><p className="mt-1 text-sm text-secondary">Invite → staff completes details → authorized review → access activates. Nobody needs to copy an account ID.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button><Button onClick={() => { setGenerated(""); setOpen(true); }}><UserPlus className="h-4 w-4" />Invite staff</Button></div></div>
    <SectionCard>{items.length ? <div className="divide-y">{items.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><UserCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.fullName || item.email}</p><StatusBadge status={String(item.status || "pending").replaceAll("_", " ")} /></div><p className="mt-1 text-sm text-secondary">{item.roleTitle || STAFF_ROLE_PACKS[item.rolePackId]?.name} · {item.department}</p><p className="mt-1 text-xs text-tertiary">{item.email}{item.managerName ? ` · Manager ${item.managerName}` : ""}</p></div><div className="flex flex-wrap gap-2">{item.status === "awaiting_approval" ? <Button size="sm" onClick={() => { setReviewing(item); setReviewNote(""); }}>Review submission</Button> : <Button size="sm" variant="outline" onClick={() => { setReviewing(item); setReviewNote(item.reviewNote || ""); }}>Open</Button>}</div></div>)}</div> : <EmptyState icon={Link2} title="No onboarding invitations" description="Create a secure invitation when a candidate is ready to join Spotly. Their signed-in account is linked automatically after approval." />}</SectionCard>

    <Modal open={open} onClose={() => setOpen(false)} title="Invite a Spotly staff member" description="Assign the intended role now. Access is granted only after the invitee submits onboarding and an authorized reviewer approves it." size="lg"><form onSubmit={create} className="space-y-5 p-5">{generated ? <div className="space-y-4"><div className="rounded-xl bg-[var(--success-soft)] p-4 text-[var(--on-success-soft)]"><CheckCircle2 className="h-5 w-5" /><p className="mt-2 font-semibold">Onboarding link generated</p><p className="mt-1 break-all text-sm">{generated}</p></div><div className="flex flex-wrap gap-2"><Button onClick={copyLink}><ClipboardCopy className="h-4 w-4" />Copy link</Button><Button variant="outline" onClick={() => { setGenerated(""); setOpen(false); }}>Done</Button></div></div> : <><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input required className={`${inputClass} mt-2`} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label className="text-sm font-semibold">Work email<input required type="email" className={`${inputClass} mt-2`} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="text-sm font-semibold">Role<select className={`${inputClass} mt-2`} value={form.rolePackId} onChange={(event) => { const pack = STAFF_ROLE_PACKS[event.target.value]; setForm({ ...form, rolePackId: event.target.value, department: pack.department }); }}>{Object.values(STAFF_ROLE_PACKS).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label><label className="text-sm font-semibold">Department<select className={`${inputClass} mt-2`} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>{STAFF_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></label><label className="text-sm font-semibold">Employment type<select className={`${inputClass} mt-2`} value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })}>{STAFF_EMPLOYMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-semibold">Start date<input type="date" className={`${inputClass} mt-2`} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><div className="sm:col-span-2"><p className="mb-2 text-sm font-semibold">Manager</p><EntityPicker value={form.managerId} onChange={(value) => setForm({ ...form, managerId: value })} options={managerOptions} title="Choose a manager" placeholder="Search eligible managers" /></div></div><Button type="submit" loading={busy === "create"}><Send className="h-4 w-4" />Generate secure onboarding link</Button></>}</form></Modal>

    <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={reviewing ? `${reviewing.fullName || reviewing.email} onboarding` : "Onboarding review"} size="lg">{reviewing && <div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2"><Card variant="plain" className="bg-grouped p-4"><p className="text-xs text-tertiary">Role</p><p className="mt-1 font-semibold">{reviewing.roleTitle}</p><p className="mt-1 text-sm text-secondary">{reviewing.department} · {reviewing.employmentType}</p></Card><Card variant="plain" className="bg-grouped p-4"><p className="text-xs text-tertiary">Status</p><div className="mt-2"><StatusBadge status={String(reviewing.status).replaceAll("_", " ")} /></div></Card></div>{reviewing.onboarding && <SectionCard padded title="Submitted details"><div className="grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-secondary">Phone</span><br/><strong>{reviewing.onboarding.phone}</strong></p><p><span className="text-secondary">Work arrangement</span><br/><strong className="capitalize">{reviewing.onboarding.workArrangement}</strong></p><p><span className="text-secondary">Emergency contact</span><br/><strong>{reviewing.onboarding.emergencyContactName}</strong></p><p><span className="text-secondary">Emergency phone</span><br/><strong>{reviewing.onboarding.emergencyContactPhone}</strong></p></div></SectionCard>}<label className="block text-sm font-semibold">Review note<textarea className="field-control mt-2 min-h-24 w-full" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Required when asking for changes; optional when approving." /></label><div className="flex flex-wrap justify-end gap-2">{reviewing.status === "awaiting_approval" && <><Button variant="outline" onClick={() => decide("request_changes")} loading={busy === "request_changes"} disabled={!reviewNote.trim()}>Request changes</Button><Button onClick={() => decide("approve")} loading={busy === "approve"}><CheckCircle2 className="h-4 w-4" />Approve & activate</Button></>} {["pending", "changes_requested"].includes(reviewing.status) && <Button variant="danger" onClick={() => decide("revoke")} loading={busy === "revoke"}>Revoke invitation</Button>}</div></div>}</Modal>
  </div>;
}
