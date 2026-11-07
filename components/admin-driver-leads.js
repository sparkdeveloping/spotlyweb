"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Send, Copy, Phone, Mail, MessageCircle, Archive, Pencil, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { DRIVER_COUNTRIES, DRIVER_COUNTRY_OPTIONS } from "@/lib/driver-regions";
import { DRIVER_CAPABILITIES, capabilitySupportsVehicle } from "@/lib/driver-capabilities";
import { Badge, Button, Card, PageHeader, SectionCard } from "@/components/ui";

const EMPTY = { legalName: "", email: "", phone: "", country: "", city: "", vehicleType: "", vehicleMake: "", vehicleModel: "", vehicleRegistration: "", licenceReference: "", requestedCapabilities: [], preferredZones: [], notes: "" };
const VEHICLES = [{ id: "", name: "Not yet known" }, { id: "bicycle", name: "Bicycle" }, { id: "motorcycle", name: "Motorcycle" }, { id: "car", name: "Car" }, { id: "van", name: "Van" }];
const asDate = (v) => { if (!v) return "—"; const date = new Date(typeof v === "object" && ("seconds" in v || "_seconds" in v) ? (v.seconds ?? v._seconds) * 1000 : v); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(); };
function leadProgress(value) { const checks = [value.legalName, value.email || value.phone, value.country, value.city, value.vehicleType, value.vehicleType === "bicycle" ? true : value.vehicleMake && value.vehicleModel, value.vehicleType === "bicycle" ? true : value.vehicleRegistration, value.requestedCapabilities?.length, value.licenceReference]; return checks.filter(Boolean).length; }
function LeadForm({ value, setValue, existing, save, saving, error }) {
  const field = (name, label, props = {}) => <label className="text-sm font-medium">{label}<input className="field-control mt-2 w-full" value={value[name] || ""} onChange={(event) => setValue((v) => ({ ...v, [name]: event.target.value }))} {...props} /></label>;
  const country = DRIVER_COUNTRIES[value.country];
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
    <SectionCard padded title={existing ? "Complete this prospect" : "Add a prospective Driver"} description="Start with a name, a country and one contact method. Everything else can be completed later by Spotly or the Driver.">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("legalName", "Full name *", { required: true, autoComplete: "name" })}
        <label className="text-sm font-medium">Country *<select required className="field-control mt-2 w-full" value={value.country} onChange={(e) => setValue((v) => ({ ...v, country: e.target.value, city: "" }))}><option value="">Choose country</option>{DRIVER_COUNTRY_OPTIONS.map((v) => <option value={v.code} key={v.code}>{v.name}</option>)}</select></label>
        {field("phone", "Phone (or email below)", { type: "tel", placeholder: country?.dialCode || "International number" })}
        {field("email", "Email (or phone above)", { type: "email", autoComplete: "email" })}
        <label className="text-sm font-medium">City<input className="field-control mt-2 w-full" list="lead-cities" value={value.city || ""} onChange={(e) => setValue((v) => ({ ...v, city: e.target.value }))} placeholder="Can be filled later" /><datalist id="lead-cities">{(country?.cities || []).map((city) => <option value={city} key={city} />)}</datalist></label>
        <label className="text-sm font-medium">Vehicle<select className="field-control mt-2 w-full" value={value.vehicleType || ""} onChange={(e) => setValue((v) => ({ ...v, vehicleType: e.target.value, requestedCapabilities: (v.requestedCapabilities || []).filter((id) => capabilitySupportsVehicle(id, e.target.value)) }))}>{VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        {field("vehicleMake", "Vehicle make", { placeholder: "e.g. Toyota" })}
        {field("vehicleModel", "Vehicle model", { placeholder: "e.g. Vitz" })}
        {field("vehicleRegistration", "Number plate", { placeholder: "Optional until verified" })}
        {field("licenceReference", "Driver licence number", { placeholder: "Unverified, optional" })}
      </div>
      <div className="mt-5"><p className="mb-2 text-sm font-semibold">Work the Driver is interested in</p><div className="grid gap-2 sm:grid-cols-2">{Object.values(DRIVER_CAPABILITIES).map((cap) => <label key={cap.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><input type="checkbox" disabled={!value.vehicleType || !capabilitySupportsVehicle(cap.id, value.vehicleType)} checked={(value.requestedCapabilities || []).includes(cap.id)} onChange={(e) => setValue((v) => ({ ...v, requestedCapabilities: e.target.checked ? [...(v.requestedCapabilities || []), cap.id] : v.requestedCapabilities.filter((id) => id !== cap.id) }))} />{cap.label}</label>)}</div></div>
      <label className="mt-5 block text-sm font-medium">Working areas (comma-separated)<input className="field-control mt-2 w-full" value={(value.preferredZones || []).join(", ")} onChange={(e) => setValue((v) => ({ ...v, preferredZones: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))} placeholder="Optional" /></label>
      <label className="mt-4 block text-sm font-medium">Private staff handover notes<textarea rows={3} className="field-control mt-2 w-full" value={value.notes || ""} onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))} placeholder="What was discussed and who should follow up? Do not record sensitive document images here." /></label>
      <p className="mt-4 text-xs text-secondary">Recruiters cannot approve a licence, accept consent or activate a Driver. Correcting email or phone securely invalidates any previously shared link and creates a replacement. Documents and payout details remain in the Driver application.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-danger">{error}</p>}
      <Button submit className="mt-5" loading={saving}>{existing ? "Save progress" : "Save and create private invitation"}</Button>
    </SectionCard>
  </form>;
}

export function AdminDriverLeads() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("awaiting_claim");
  const [selected, setSelected] = useState("new");
  const [form, setForm] = useState({ ...EMPTY });
  const [invitation, setInvitation] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await authenticatedFetch("/api/admin/driver-leads"); setRows(data.leads || []); setError(""); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const current = rows.find((r) => r.id === selected);
  const shown = useMemo(() => rows.filter((r) => (filter === "all" || r.status === filter) && `${r.legalName} ${r.email} ${r.phone} ${r.city} ${r.country} ${r.status}`.toLowerCase().includes(query.toLowerCase())), [rows, filter, query]);
  function select(value) { setSelected(value?.id || "new"); setForm(value ? { ...EMPTY, ...value } : { ...EMPTY }); setInvitation(""); setError(""); setMessage(""); }
  async function act(action, details = {}) {
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = { action, ...details };
      const result = await authenticatedFetch("/api/admin/driver-leads", { method: "POST", body: JSON.stringify(payload) });
      if (result.invitationUrl) setInvitation(result.invitationUrl);
      if (action === "create") setSelected(result.leadId);
      if (action === "archive") { setSelected("new"); setForm({ ...EMPTY }); setInvitation(""); }
      setMessage(action === "invite" ? "New private link generated. The previous one is now invalid." : action === "create" ? "Profile saved. Share the private invitation using the controls below." : action === "archive" ? "Prospect archived." : result.invitationUrl ? "Contact corrected. The old link is invalid; share the replacement private link below." : "Progress saved.");
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function shareCopy() {
    try { await navigator.clipboard.writeText(invitation); setMessage("Private link copied. Share only with the intended Driver."); }
    catch { setError("Your browser blocked clipboard access. Use Email or SMS to share the link."); }
  }
  const draft = current || form;
  const text = `Spotly Driver: Finish the profile our team started for you. Sign in with your verified contact details. This private link expires in 30 days: ${invitation}`;
  return <div className="space-y-6">
    <PageHeader eyebrow="Driver acquisition" title="Prospective Drivers" description="Collect only the essentials in the field, let an internal teammate complete missing details, and securely hand over the same profile to the Driver." />
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Awaiting claim", rows.filter((r) => r.status === "awaiting_claim").length], ["Claimed", rows.filter((r) => r.status === "claimed").length], ["Archived", rows.filter((r) => r.status === "archived").length]].map(([label, count]) => <Card key={label} className="p-4"><p className="text-xs font-semibold text-secondary">{label}</p><p className="mt-2 text-2xl font-semibold">{count}</p></Card>)}
    </div>
    <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Button className="w-full" onClick={() => select(null)}><Plus className="h-4 w-4" />Add prospective Driver</Button>
        <div className="flex gap-2"><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-secondary" /><input className="field-control w-full pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, city…" /></label><Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button></div>
        <select aria-label="Filter prospective Drivers" className="field-control w-full" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="awaiting_claim">Awaiting claim</option><option value="claimed">Claimed</option><option value="archived">Archived</option><option value="all">All prospects</option></select>
        {loading && <p className="p-3 text-sm text-secondary">Loading prospects…</p>}
        {!loading && !shown.length && <p className="rounded-xl bg-[var(--surface-2)] p-4 text-sm text-secondary">No matching profiles. Create the first one above.</p>}
        <div className="space-y-2">{shown.map((r) => <button type="button" key={r.id} onClick={() => select(r)} className={`w-full rounded-xl border p-4 text-left transition ${selected === r.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface)] hover:bg-[var(--surface-2)]"}`}><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{r.legalName}</strong><Badge tone={r.status === "claimed" ? "success" : "neutral"}>{r.status === "awaiting_claim" ? "Not claimed" : r.status}</Badge></span><span className="mt-1 block truncate text-xs text-secondary">{r.phone || r.email}</span><span className="mt-2 block text-xs text-secondary">{DRIVER_COUNTRIES[r.country]?.name || r.country} · {r.city || "City pending"} · {leadProgress(r)}/9 fields</span><span className="mt-1 block text-xs text-tertiary">Created {asDate(r.createdAt)}</span></button>)}</div>
      </div>
      <div className="min-w-0 space-y-5">
        {error && <p role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-[var(--surface-2)] p-4 text-sm">{message}</p>}
        {(!current || current.status === "awaiting_claim") && <LeadForm key={selected} value={form} setValue={setForm} existing={Boolean(current)} saving={saving} error="" save={() => act(current ? "update" : "create", { leadId: current?.id, lead: { ...form, preferredZones: form.preferredZones || [], requestedCapabilities: form.requestedCapabilities || [] } })} />}
        {current?.status === "claimed" && <SectionCard padded title="Driver accepted the invitation" description="The authenticated Driver owns the next part of the application. Recruiter edits are now closed."><p className="text-sm text-secondary">Claimed {asDate(current.claimedAt)}.</p><Button asChild variant="outline" className="mt-4"><a href={`/mobility?driver=${encodeURIComponent(current.claimedBy)}`}>Open verified Driver record</a></Button></SectionCard>}
        {current?.status === "archived" && <SectionCard padded title="Archived prospect" description={current.archiveReason || "This profile is no longer open for invitation."} />}
        {current?.status === "awaiting_claim" && <SectionCard padded title="Hand over the profile" description="A link is single-use, valid for 30 days and attached to the Driver’s verified email or phone. Generating a new link invalidates the previous one.">
          <div className="flex flex-wrap gap-2"><Button loading={saving} onClick={() => act("invite", { leadId: current.id })}><Send className="h-4 w-4" />Generate new private link</Button>{current.phone && <Button asChild variant="outline"><a href={`tel:${current.phone}`}><Phone className="h-4 w-4" />Call Driver</a></Button>}</div>
          {invitation && <div className="mt-4 space-y-3"><p className="break-all rounded-xl bg-[var(--surface-2)] p-3 text-xs">{invitation}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={shareCopy}><Copy className="h-4 w-4" />Copy link</Button>{current.email && <Button asChild variant="outline"><a href={`mailto:${current.email}?subject=${encodeURIComponent("Finish your Spotly Driver profile")}&body=${encodeURIComponent(text)}`}><Mail className="h-4 w-4" />Email</a></Button>}{current.phone && <><Button asChild variant="outline"><a href={`sms:${current.phone}?body=${encodeURIComponent(text)}`}><MessageCircle className="h-4 w-4" />Text</a></Button><Button asChild variant="outline"><a href={`https://wa.me/${current.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a></Button></>}</div><p className="text-xs text-secondary">Spotly does not send messages until you open the chosen app and confirm sending. The link will not appear here again after leaving this screen.</p></div>}
          <div className="mt-6 border-t pt-4"><label className="block text-sm font-medium">Reason for archiving<input className="field-control mt-2 w-full" value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Required to archive a lead" /></label><Button variant="outline" className="mt-3" disabled={archiveReason.trim().length < 3 || saving} onClick={() => act("archive", { leadId: current.id, reason: archiveReason })}><Archive className="h-4 w-4" />Archive prospect</Button></div>
        </SectionCard>}
      </div>
    </div>
  </div>;
}
