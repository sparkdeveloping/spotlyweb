"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, MoreHorizontal, Plus, RefreshCw, ShieldCheck, UserRound, UsersRound, XCircle } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, ConfirmDialog, FieldLabel, fieldClass, selectClass } from "@/components/business/shared";
import { businessPermissions, businessRoleTemplates } from "@/data/business-config";
import { inviteBusinessStaff, saveBusinessProfile } from "@/lib/firebase-services";
import { resendBusinessInvitation, revokeBusinessInvitation, updateBusinessMembership } from "@/lib/business-services";
import { authenticatedFetch } from "@/lib/api-client";

function InviteModal({ open, onClose }) {
  const { business, branches, user, membership } = useBusinessWorkspace();
  const [form, setForm] = useState({ name: "", email: "", role: "order_staff", branchIds: [], permissions: [] });
  const canGrantBusinessWide = ["organization_owner", "business_owner", "business_manager"].includes(membership?.role) || membership?.permissions?.includes("*") || membership?.permissions?.includes("staff.*");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) setForm({ name: "", email: "", role: "order_staff", branchIds: branches.length === 1 ? [branches[0].id] : [], permissions: businessRoleTemplates.find((item) => item.id === "order_staff")?.permissions || [] }); }, [open, branches]);

  function setRole(role) {
    const template = businessRoleTemplates.find((item) => item.id === role);
    setForm((current) => ({ ...current, role, permissions: template?.permissions || [] }));
  }

  function toggleBranch(id) {
    setForm((current) => ({ ...current, branchIds: current.branchIds.includes(id) ? current.branchIds.filter((item) => item !== id) : [...current.branchIds, id] }));
  }

  function togglePermission(id) {
    setForm((current) => ({ ...current, permissions: current.permissions.includes(id) ? current.permissions.filter((item) => item !== id) : [...current.permissions, id] }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.email.trim()) return toast("Enter the team member's email address.", { type: "error", title: "Email required" });
    if (!canGrantBusinessWide && !form.branchIds.length) return toast("Choose at least one location for this teammate.", { type: "error", title: "Location required" });
    setSaving(true);
    try {
      const invitationId = await inviteBusinessStaff(form, business, user);
      let emailSent = false;
      try {
        await authenticatedFetch("/api/email/send", { method: "POST", body: JSON.stringify({ type: "business_invitation", to: form.email, data: { name: form.name, businessName: business.name, inviterName: user.displayName || user.email, invitationId, businessId: business.id } }) });
        emailSent = true;
      } catch {
        emailSent = false;
      }
      toast(emailSent ? "The invitation was saved and emailed." : "The invitation was saved. Email delivery is not configured, so share the sign-in link directly.", { title: "Team invitation ready", type: emailSent ? "success" : "info", duration: 5200 });
      onClose();
    } catch (error) {
      toast(error.message || "The invitation could not be created.", { type: "error", title: "Could not invite" });
    } finally { setSaving(false); }
  }

  return <Modal open={open} onClose={onClose} title="Invite a team member" size="lg"><form onSubmit={submit} className="space-y-5 p-5">
    <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Name"><input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Team member name" /></FieldLabel><FieldLabel label="Email address" required><input type="email" className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></FieldLabel></div>
    <FieldLabel label="Access template"><select className={selectClass} value={form.role} onChange={(event) => setRole(event.target.value)}>{businessRoleTemplates.filter((item) => item.id !== "organization_owner").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FieldLabel>
    <div><p className="text-sm font-semibold">Assigned branches</p><p className="mt-1 text-xs text-secondary">{canGrantBusinessWide ? "Leave every location unchecked only for business-wide access." : "Choose the location this teammate will work in. Your own access does not allow business-wide invitations."}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} /><span className="text-sm font-medium">{branch.branchName || branch.name}</span></label>)}</div></div>
    <div><p className="text-sm font-semibold">Permissions</p><div className="mt-3 grid max-h-52 gap-2 overflow-y-auto rounded-2xl border p-3 sm:grid-cols-2">{businessPermissions.map((permission) => <label key={permission.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-grouped"><input type="checkbox" checked={form.permissions.includes(permission.id) || form.permissions.some((value) => value.endsWith(".*") && permission.id.startsWith(value.slice(0, -1)))} disabled={form.role !== "custom"} onChange={() => togglePermission(permission.id)} /><span className="text-sm">{permission.label}</span></label>)}</div></div>
    <div className="flex justify-end gap-3 border-t pt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Send invitation</Button></div>
  </form></Modal>;
}

function MemberModal({ member, open, onClose }) {
  const { branches, user } = useBusinessWorkspace();
  const [form, setForm] = useState({ role: "order_staff", branchIds: [], permissions: [], status: "active" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (member) setForm({ role: member.role || "order_staff", branchIds: member.branchIds || [], permissions: member.permissions || [], status: member.status || "active" }); }, [member]);

  function setRole(role) {
    const template = businessRoleTemplates.find((item) => item.id === role);
    setForm((current) => ({ ...current, role, permissions: template?.permissions || [] }));
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true);
    try { await updateBusinessMembership(member.id, form, user); toast("Team access has been updated."); onClose(); }
    catch (error) { toast(error.message || "Access could not be updated.", { type: "error", title: "Could not update" }); }
    finally { setSaving(false); }
  }

  return <Modal open={open} onClose={onClose} title="Manage team access"><form onSubmit={submit} className="space-y-5 p-5"><div className="rounded-2xl bg-grouped p-4"><p className="font-semibold">{member?.displayName || member?.name || member?.email || "Business owner"}</p><p className="mt-1 text-sm text-secondary">{member?.email || "Primary account"}</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Role"><select className={selectClass} value={form.role} onChange={(event) => setRole(event.target.value)}>{businessRoleTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FieldLabel><FieldLabel label="Account status"><select className={selectClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></select></FieldLabel></div><div><p className="text-sm font-semibold">Location access</p><div className="mt-3 space-y-2">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.branchIds.includes(branch.id)} onChange={() => setForm((current) => ({ ...current, branchIds: current.branchIds.includes(branch.id) ? current.branchIds.filter((id) => id !== branch.id) : [...current.branchIds, branch.id] }))} /><span className="text-sm font-medium">{branch.branchName || branch.name}</span></label>)}</div></div><div className="flex justify-end gap-3 border-t pt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Save access</Button></div></form></Modal>;
}

export function StaffView() {
  const { business, members, invitations, branches, user, membership } = useBusinessWorkspace();
  const [queryText, setQueryText] = useState("");
  const [tab, setTab] = useState("team");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const canManageTeam = ["organization_owner", "business_owner", "business_manager"].includes(membership?.role) || membership?.permissions?.includes("*") || membership?.permissions?.includes("staff.*") || membership?.permissions?.includes("staff.manage");

  const visibleMembers = useMemo(() => members.filter((item) => [item.displayName, item.name, item.email, item.userId, item.role].join(" ").toLowerCase().includes(queryText.toLowerCase())), [members, queryText]);
  const visibleInvites = useMemo(() => invitations.filter((item) => [item.name, item.email, item.role, item.status].join(" ").toLowerCase().includes(queryText.toLowerCase())), [invitations, queryText]);

  async function reviewTeam() {
    setBusy(true);
    try { await saveBusinessProfile(business.id, { teamReviewedAt: new Date().toISOString() }, user); toast("Team access review recorded.", { title: "Review complete" }); }
    catch (error) { toast(error.message || "The review could not be recorded.", { type: "error" }); }
    finally { setBusy(false); }
  }

  async function resend(invitation) {
    setBusy(true);
    try {
      await resendBusinessInvitation(invitation.id, user);
      try { await authenticatedFetch("/api/email/send", { method: "POST", body: JSON.stringify({ type: "business_invitation", to: invitation.email, data: { name: invitation.name, businessName: business.name, inviterName: user.displayName || user.email, invitationId: invitation.id, businessId: business.id } }) }); } catch {}
      toast("The invitation has been refreshed.", { title: "Invitation resent" });
    } catch (error) { toast(error.message || "The invitation could not be resent.", { type: "error" }); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!confirm) return;
    setBusy(true);
    try { await revokeBusinessInvitation(confirm.id, user); toast("The invitation has been revoked."); setConfirm(null); }
    catch (error) { toast(error.message || "The invitation could not be revoked.", { type: "error" }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Staff & access" description="Give each person only the businesses, locations, and controls they need." actions={<><BusinessSwitcher />{canManageTeam && <Button variant="outline" loading={busy} onClick={reviewTeam}><ShieldCheck className="h-4 w-4" />Confirm access review</Button>}{canManageTeam && <Button onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" />Invite teammate</Button>}</>} />
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search people, email, or role" /><Tabs value={tab} onChange={setTab} tabs={[{ value: "team", label: `Team (${members.length})` }, { value: "invites", label: `Invitations (${invitations.filter((item) => item.status === "pending").length})` }]} /></div>
    {tab === "team" ? <SectionCard title="Active access" description="Owners and staff with current access to this business.">{visibleMembers.length ? <div className="divide-y">{visibleMembers.map((member) => <div key={member.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-business-soft text-business"><UserRound className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{member.displayName || member.name || member.email || "Business owner"}</p><p className="mt-1 truncate text-xs text-secondary">{member.email || "Primary account"} · {businessRoleTemplates.find((item) => item.id === member.role)?.name || member.role}</p><div className="mt-2 flex flex-wrap gap-1">{member.branchIds?.length ? member.branchIds.map((id) => <Badge key={id}>{branches.find((branch) => branch.id === id)?.branchName || branches.find((branch) => branch.id === id)?.name || "Assigned location"}</Badge>) : <Badge tone="accent">Business-wide</Badge>}</div></div><StatusBadge status={member.status || "active"} />{canManageTeam ? <Button size="sm" variant="outline" onClick={() => setEditing(member)}><MoreHorizontal className="h-4 w-4" />Manage</Button> : <Badge tone="neutral">View only</Badge>}</div>)}</div> : <EmptyState icon={UsersRound} title="No active team records" description="Invite the first teammate or verify that your own membership was created correctly." action={canManageTeam ? <Button onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" />Invite teammate</Button> : <Button href="/business/support" variant="outline">Ask for access</Button>} />}</SectionCard> : <SectionCard title="Pending and previous invitations" description="Every invitation stays visible with its delivery and acceptance state.">{visibleInvites.length ? <div className="divide-y">{visibleInvites.map((invite) => <div key={invite.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grouped text-secondary"><Mail className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{invite.name || invite.email}</p><p className="mt-1 text-xs text-secondary">{invite.email} · {businessRoleTemplates.find((item) => item.id === invite.role)?.name || invite.role}</p></div><StatusBadge status={invite.status || "pending"} />{canManageTeam && invite.status === "pending" && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => resend(invite)}><RefreshCw className="h-4 w-4" />Resend</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirm(invite)}><XCircle className="h-4 w-4" />Revoke</Button></div>}</div>)}</div> : <EmptyState icon={Mail} title="No invitations in this view" description="New invitations remain here until accepted or revoked." />}</SectionCard>}
    <Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-success"><CheckCircle2 className="h-5 w-5" /></span><div><h2 className="font-bold">Access is explicit and reviewable</h2><p className="mt-1 text-sm leading-6 text-secondary">Location access, roles, permissions, invitations, and account status are recorded clearly. Every change is included in the activity history.</p></div></div></Card>
    {canManageTeam && <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />}
    {canManageTeam && <MemberModal member={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />}
    <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Revoke this invitation?" description="The invitation link will no longer be accepted. You can create a new invitation later." confirmLabel="Revoke invitation" danger loading={busy} onConfirm={revoke} />
  </div>;
}
