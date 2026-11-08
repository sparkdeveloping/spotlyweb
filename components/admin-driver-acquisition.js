"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Copy, Download, MapPin, Pause, Play, Plus, QrCode, RefreshCw, UsersRound } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { SPOTLY_COUNTRIES, countryDefinition } from "@/lib/country-engine";
import { DRIVER_ACQUISITION_MEDIA } from "@/lib/driver-acquisition";
import { Badge, Button, Card, PageHeader, SectionCard } from "@/components/ui";

const EMPTY = { name: "", country: "", city: "", placement: "", medium: "qr_flyer", notes: "" };
const mediumName = (value) => ({ qr_flyer: "QR · flyer", qr_poster: "QR · poster", qr_card: "QR · card", social: "Social", referral: "Referral", direct: "Direct", other: "Other" }[value] || value);
const pct = (a, b) => b ? `${((Number(a || 0) / Number(b || 1)) * 100).toFixed(1)}%` : "0%";

function loadQrLibrary() {
  if (typeof window === "undefined") return Promise.reject(new Error("QR generation is only available in the browser."));
  if (window.QRCode) return Promise.resolve(window.QRCode);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-spotly-qr="1"]');
    if (existing) { existing.addEventListener("load", () => resolve(window.QRCode), { once: true }); existing.addEventListener("error", () => reject(new Error("QR generator could not be loaded.")), { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
    script.async = true;
    script.dataset.spotlyQr = "1";
    script.onload = () => window.QRCode ? resolve(window.QRCode) : reject(new Error("QR generator did not initialize."));
    script.onerror = () => reject(new Error("QR generator could not be loaded."));
    document.head.appendChild(script);
  });
}

export function AdminDriverAcquisition() {
  const [data, setData] = useState({ campaigns: [], totals: {} });
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const country = countryDefinition(form.country);
  const load = useCallback(async () => {
    setBusy("load");
    try { setData(await authenticatedFetch("/api/admin/driver-acquisition?days=30")); setError(""); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const campaigns = data.campaigns || [];
  const totals = data.totals || {};
  const cityRows = useMemo(() => {
    const map = new Map();
    for (const campaign of campaigns) {
      const key = `${campaign.country}|${campaign.city}`;
      if (!map.has(key)) map.set(key, { country: campaign.country, city: campaign.city, views: 0, starts: 0, submissions: 0, newLeads: 0 });
      const row = map.get(key); const metrics = campaign.metrics || {};
      for (const field of ["views", "starts", "submissions", "newLeads"]) row[field] += Number(metrics[field] || 0);
    }
    return [...map.values()].sort((a,b)=>b.newLeads-a.newLeads || b.views-a.views);
  }, [campaigns]);

  async function create() {
    setError(""); setMessage(""); setBusy("create");
    try {
      const result = await authenticatedFetch("/api/admin/driver-acquisition", { method: "POST", body: JSON.stringify({ action: "create", ...form }) });
      setForm(EMPTY); setMessage(`Campaign created: ${result.campaign.url}`); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  async function change(slug, action) {
    setError(""); setMessage(""); setBusy(`${action}:${slug}`);
    try { await authenticatedFetch("/api/admin/driver-acquisition", { method: "POST", body: JSON.stringify({ action, slug }) }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  async function copy(url) {
    try { await navigator.clipboard.writeText(url); setMessage("Tracking link copied."); }
    catch { setError("The browser blocked clipboard access. Select the campaign link manually."); }
  }
  async function downloadQr(campaign) {
    setError(""); setMessage(""); setBusy(`qr:${campaign.slug}`);
    try {
      const QRCode = await loadQrLibrary();
      const holder = document.createElement("div");
      holder.style.position = "fixed"; holder.style.left = "-99999px"; holder.style.top = "0";
      document.body.appendChild(holder);
      new QRCode(holder, { text: campaign.url, width: 1024, height: 1024, correctLevel: QRCode.CorrectLevel.H });
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      const canvas = holder.querySelector("canvas");
      if (!canvas) throw new Error("The QR image could not be generated.");
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      holder.remove();
      if (!blob) throw new Error("The QR image could not be exported.");
      const href = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = href; link.download = `spotly-driver-${campaign.slug}-qr.png`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href);
      setMessage(`QR downloaded for ${campaign.name}. The encoded URL is ${campaign.url}`);
    } catch (err) { setError(`${err.message} You can still copy the tracking link and turn it into a QR code without losing attribution.`); }
    finally { setBusy(""); }
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Driver acquisition" title="Campaigns & QR tracking" description="Create one trackable entry point per flyer, poster, city, partner or placement. Every successful form enters the same Prospective Drivers pipeline." actions={<Button variant="outline" onClick={load} loading={busy==="load"}><RefreshCw className="h-4 w-4"/>Refresh</Button>} />
    {error ? <p className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-danger" role="alert">{error}</p> : null}
    {message ? <p className="rounded-xl bg-[var(--surface-2)] p-4 text-sm" role="status">{message}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[["Landing visits",totals.views||0],["Form starts",totals.starts||0],["Contact step",totals.contactCompletes||0],["Forms submitted",totals.submissions||0],["New prospects",totals.newLeads||0]].map(([label,value],index)=><Card key={label} className="p-4"><div className="flex items-center gap-2 text-secondary">{index===0?<BarChart3 className="h-4 w-4"/>:<UsersRound className="h-4 w-4"/>}<p className="text-xs font-semibold">{label}</p></div><p className="mt-2 text-2xl font-semibold">{value}</p>{index===4?<p className="mt-1 text-xs text-tertiary">{pct(value,totals.views)} visit → lead</p>:null}</Card>)}
    </div>
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <SectionCard padded title="Create a tracked campaign" description="Use a different campaign for each physical placement you want to measure separately.">
        <div className="space-y-4">
          <label className="block text-sm font-medium">Campaign name<input className="field-control mt-2 w-full" value={form.name} onChange={(e)=>setForm(v=>({...v,name:e.target.value}))} placeholder="Harare Driver Flyer · November"/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Country<select className="field-control mt-2 w-full" value={form.country} onChange={(e)=>setForm(v=>({...v,country:e.target.value,city:""}))}><option value="">Choose</option>{SPOTLY_COUNTRIES.map((item)=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="block text-sm font-medium">City<select className="field-control mt-2 w-full" value={form.city} disabled={!form.country} onChange={(e)=>setForm(v=>({...v,city:e.target.value}))}><option value="">Choose</option>{(country?.cities||[]).map((item)=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label></div>
          <label className="block text-sm font-medium">Placement / batch<input className="field-control mt-2 w-full" value={form.placement} onChange={(e)=>setForm(v=>({...v,placement:e.target.value}))} placeholder="CBD kombi rank · Flyer batch A"/><span className="mt-1 block text-xs text-secondary">This is the dimension that lets you compare two QR codes in the same city.</span></label>
          <label className="block text-sm font-medium">Medium<select className="field-control mt-2 w-full" value={form.medium} onChange={(e)=>setForm(v=>({...v,medium:e.target.value}))}>{DRIVER_ACQUISITION_MEDIA.map((value)=><option key={value} value={value}>{mediumName(value)}</option>)}</select></label>
          <label className="block text-sm font-medium">Internal notes<textarea className="field-control mt-2 min-h-20 w-full" value={form.notes} onChange={(e)=>setForm(v=>({...v,notes:e.target.value}))} placeholder="Optional: team, print batch, partner, dates, placement instructions"/></label>
          <Button className="w-full" loading={busy==="create"} disabled={!form.name||!form.country||!form.city||!form.placement} onClick={create}><Plus className="h-4 w-4"/>Create campaign & tracking URL</Button>
        </div>
      </SectionCard>
      <SectionCard title="Campaign performance" description="30-day first-party funnel totals. QR downloads encode the campaign-specific Spotly URL; the QR provider never receives Driver details.">
        <div className="divide-y">{campaigns.map((campaign)=>{const m=campaign.metrics||{};return <div key={campaign.slug} className="p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{campaign.name}</p><Badge tone={campaign.status==="active"?"success":campaign.status==="paused"?"warning":"neutral"}>{campaign.status}</Badge><Badge tone="neutral">{mediumName(campaign.medium)}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-xs text-secondary"><MapPin className="h-3.5 w-3.5"/>{campaign.city}, {countryDefinition(campaign.country)?.name||campaign.country} · {campaign.placement}</p><p className="mt-2 break-all text-xs text-tertiary">{campaign.url}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>copy(campaign.url)}><Copy className="h-4 w-4"/>Copy link</Button><Button size="sm" variant="outline" loading={busy===`qr:${campaign.slug}`} onClick={()=>downloadQr(campaign)}><QrCode className="h-4 w-4"/><Download className="h-3.5 w-3.5"/>QR</Button>{campaign.status==="active"?<Button size="sm" variant="ghost" loading={busy===`pause:${campaign.slug}`} onClick={()=>change(campaign.slug,"pause")}><Pause className="h-4 w-4"/>Pause</Button>:campaign.status==="paused"?<Button size="sm" variant="ghost" loading={busy===`resume:${campaign.slug}`} onClick={()=>change(campaign.slug,"resume")}><Play className="h-4 w-4"/>Resume</Button>:null}</div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Visits",m.views],["Starts",m.starts],["Contact step",m.contactCompletes],["Submitted",m.submissions],["New leads",m.newLeads]].map(([label,value])=><div key={label} className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-[11px] font-semibold text-tertiary">{label}</p><p className="mt-1 text-lg font-semibold">{value||0}</p></div>)}</div><p className="mt-3 text-xs text-secondary">Visit → lead {pct(m.newLeads,m.views)} · Start → submit {pct(m.submissions,m.starts)}</p></div>})}{!campaigns.length?<div className="p-8 text-center text-sm text-secondary">No Driver acquisition campaigns yet. Create one to get a campaign URL and QR download.</div>:null}</div>
      </SectionCard>
    </div>
    {cityRows.length ? <SectionCard title="City performance" description="Rolls up campaign results by the city assigned when each QR/link was created."><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-secondary"><th className="p-4">City</th><th className="p-4">Visits</th><th className="p-4">Starts</th><th className="p-4">Submitted</th><th className="p-4">New prospects</th><th className="p-4">Conversion</th></tr></thead><tbody>{cityRows.map((row)=><tr key={`${row.country}-${row.city}`} className="border-b last:border-0"><td className="p-4 font-semibold">{row.city} <span className="font-normal text-tertiary">· {countryDefinition(row.country)?.name||row.country}</span></td><td className="p-4">{row.views}</td><td className="p-4">{row.starts}</td><td className="p-4">{row.submissions}</td><td className="p-4">{row.newLeads}</td><td className="p-4">{pct(row.newLeads,row.views)}</td></tr>)}</tbody></table></div></SectionCard> : null}
  </div>;
}
