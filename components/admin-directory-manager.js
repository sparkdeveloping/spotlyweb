"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, ServerCog } from "lucide-react";
import { Button, Card, Modal, ProgressBar, StatusBadge } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";
import { seedSummary } from "@/data/zimbabwe-businesses";

export function AdminDirectoryManager({ liveBusinessCount = 0, compact = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  async function refresh() {
    setLoading(true);
    try { setStatus(await authenticatedFetch("/api/admin/seed")); }
    catch (error) { setStatus({ ok: false, error: error.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function seed() {
    setConfirmOpen(false);
    setSeeding(true);
    try {
      const result = await authenticatedFetch("/api/admin/seed", { method: "POST", body: JSON.stringify({ includeBusinesses: true }) });
      toast(`${result.businesses} business brands and ${result.branches} locations are now connected correctly. ${result.migratedMemberships || 0} memberships were updated.`, { title: "Directory upgraded", duration: 6500 });
      await refresh();
    } catch (error) { toast(error.message || "The directory could not be populated.", { type: "error", title: "Import failed", duration: 6500 }); }
    finally { setSeeding(false); }
  }

  const expected = status?.expectedBusinesses || seedSummary.brands;
  const count = status?.directoryBrands ?? status?.businesses ?? liveBusinessCount;
  const percent = expected ? Math.min(100, Math.round((count / expected) * 100)) : 0;
  if (compact) return <><Card className="p-5"><div className="flex items-start gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${count >= expected ? "bg-emerald-50 text-success" : "bg-amber-50 text-warning"}`}>{count >= expected ? <CheckCircle2 className="h-5 w-5" /> : <Database className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">Business directory</h2>{status?.seed?.status && <StatusBadge status={status.seed.status} />}</div><p className="mt-1 text-sm text-secondary">{count} business records · {status?.branches || 0} branches · {status?.organizations || 0} organizations</p><ProgressBar value={percent} className="mt-3" /></div><Button size="sm" onClick={() => setConfirmOpen(true)} loading={seeding}><Database className="h-4 w-4" />{count ? "Refresh data" : "Populate"}</Button></div></Card><Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Upgrade the business directory?" description={`This will create ${seedSummary.brands} business brands, connect ${seedSummary.listings} locations, and migrate linked memberships and claims.`}><div className="flex justify-end gap-2 p-5"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button onClick={seed} loading={seeding}>Confirm upgrade</Button></div></Modal></>;

  return <><Card className="overflow-hidden"><div className="flex flex-col gap-4 border-b bg-gradient-to-r from-slate-950 to-admin p-6 text-white sm:flex-row sm:items-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><ServerCog className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">Business directory setup</h2><p className="mt-1 text-sm text-white/75">Keep brands separate from their branches, migrate legacy records, and prepare the live claiming directory.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={refresh} loading={loading}><RefreshCw className="h-4 w-4" />Check status</Button><Button size="sm" className="bg-white text-admin hover:bg-white/90" onClick={() => setConfirmOpen(true)} loading={seeding}><Database className="h-4 w-4" />{count ? "Upgrade / refresh" : "Populate directory"}</Button></div></div><div className="grid gap-0 sm:grid-cols-4">{[
    ["Business brands", count, expected], ["Locations", status?.branches || 0, seedSummary.listings], ["Organizations", status?.organizations || 0, seedSummary.brands], ["Catalog templates", status?.catalogTemplates || 0, null]
  ].map(([label, value, target]) => <div key={label} className="border-b p-5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs font-bold uppercase tracking-[.12em] text-tertiary">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>{target && <p className="mt-1 text-xs text-secondary">Target {target}</p>}</div>)}</div><div className="border-t p-5"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${status?.ok === false ? "bg-red-50 text-danger" : count >= expected ? "bg-emerald-50 text-success" : "bg-amber-50 text-warning"}`}>{status?.ok === false ? <AlertTriangle className="h-4 w-4" /> : count >= expected ? <CheckCircle2 className="h-4 w-4" /> : <Database className="h-4 w-4" />}</span><div><p className="text-sm font-semibold">{status?.ok === false ? "Status check could not complete" : count >= expected ? "The provisional directory is live" : "The provisional directory is not fully populated"}</p><p className="mt-1 text-xs leading-5 text-secondary">{status?.error || "Version 4 keeps each brand as one business and every physical place as a branch. Refreshes preserve owner changes, migrate memberships and claims, and archive legacy branch-as-business records. Imported details remain provisional until owner or administrator confirmation."}</p></div></div></div></Card><Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Upgrade the business directory?" description={`This will create ${seedSummary.brands} business brands, connect ${seedSummary.listings} locations, and migrate linked memberships and claims.`}><div className="flex justify-end gap-2 p-5"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button onClick={seed} loading={seeding}>Confirm upgrade</Button></div></Modal></>;
}
