"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";

export function AdminClientIncidents() {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [escalating, setEscalating] = useState("");
  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const payload = await authenticatedFetch("/api/admin/client-incidents", { cache: "no-store" });
      setItems(Array.isArray(payload.incidents) ? payload.incidents : []);
    } catch (reason) { setError(reason?.status === 403 ? "This queue requires Support access." : "Incidents couldn't be loaded. Retry when connected."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const escalate = async (incidentId) => {
    setEscalating(incidentId); setError(null);
    try {
      const result = await authenticatedFetch("/api/admin/client-incidents/escalate", { method: "POST", body: JSON.stringify({ incidentId }) });
      // The support case is internal; no customer message or notification is fabricated.
      window.location.assign(`/work?view=support&conversation=${encodeURIComponent(result.conversationId)}`);
    } catch (reason) { setError(reason?.status === 403 ? "Your role cannot escalate incidents." : "The case could not be opened. Please retry."); }
    finally { setEscalating(""); }
  };
  return <section className="space-y-4" aria-label="Application incidents">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h2 className="text-lg font-semibold">Application incidents</h2>
      <p className="mt-1 text-sm text-secondary">Up to 40 recent, safely redacted browser failures. Link an incident to one internal support case when follow-up is required.</p>
    </div><Button size="sm" variant="outline" loading={pending} onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {error ? <p role="alert" className="text-sm text-secondary">{error}</p>
        : pending && !items.length ? <p className="text-sm text-secondary">Loading incident records…</p>
        : !items.length ? <div className="flex items-center gap-3 text-sm text-secondary"><ShieldCheck className="h-5 w-5" /> No incident reports in this bounded view. Reporting may be disabled.</div>
        : <div className="divide-y divide-[var(--border-subtle)]">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-secondary" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold"><span className="select-all">{item.id}</span> · {item.screen}</p><p className="mt-1 text-xs text-secondary">{item.platform} · {item.errorClass} · {item.status} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recently"}</p></div>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-secondary">{item.severity}</span>
          {item.linkedConversationId ? <a className="text-xs font-semibold text-[var(--accent)] underline" href={`/work?view=support&conversation=${encodeURIComponent(item.linkedConversationId)}`}>Open case</a> : <Button size="sm" variant="outline" disabled={Boolean(escalating)} loading={escalating === item.id} onClick={() => escalate(item.id)}>Create support case</Button>}
        </div>)}</div>}
    </div>
  </section>;
}
