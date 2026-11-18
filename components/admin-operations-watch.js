"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { summarizeOperationsWatch } from "@/lib/lx13-operations-watch.mjs";
import { Badge, Button } from "@/components/ui";

// No new Firestore reads: reuses the two existing permission-gated APIs.
// Only mounted on the Operations watch tab; no global or hidden-tab polling.
export function AdminOperationsWatch() {
  const [health, setHealth] = useState(null);
  const [incidents, setIncidents] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const busyRef = useRef(false);
  const lastCheckRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (force = false) => {
    if (document.visibilityState === "hidden" || busyRef.current || (!force && Date.now() - lastCheckRef.current < 5 * 60_000)) return;
    busyRef.current = true;
    setBusy(true);
    const [healthResult, incidentResult] = await Promise.allSettled([
      authenticatedFetch("/api/admin/operations-health", { cache: "no-store" }),
      authenticatedFetch("/api/admin/client-incidents", { cache: "no-store" }),
    ]);
    if (mountedRef.current) {
      setHealth(healthResult.status === "fulfilled" ? healthResult.value : null);
      setIncidents(incidentResult.status === "fulfilled" ? (Array.isArray(incidentResult.value.incidents) ? incidentResult.value.incidents : []) : null);
      setErrors({
        health: healthResult.status === "rejected" ? "Operational checks need Admin configuration permission or a working connection." : "",
        incidents: incidentResult.status === "rejected" ? "Incident details require Support access or a working connection." : "",
      });
      setCheckedAt(new Date().toISOString());
      lastCheckRef.current = Date.now();
      setBusy(false);
    }
    busyRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh(true);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = window.setInterval(() => refresh(), 5 * 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const summary = useMemo(() => summarizeOperationsWatch(health, incidents, { incidentsAvailable: incidents !== null }), [health, incidents]);
  const scope = health?.coverage?.collections || {};
  return <section className="space-y-5" aria-label="Operations watch">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Operations watch</h2>
        <p className="mt-1 max-w-2xl text-sm text-secondary">Live, limited operational signals. These checks cannot certify availability, successful payments, or a safe launch.</p>
        <p className="mt-1 text-xs text-secondary">{checkedAt ? `Last checked ${new Date(checkedAt).toLocaleString()}` : "Not checked yet"} · Refreshes at most every five minutes, only while this tab is visible.</p>
      </div>
      <Button variant="outline" size="sm" loading={busy} onClick={() => refresh(true)}><RefreshCw className="h-4 w-4" /> Refresh</Button>
    </div>
    {(errors.health || errors.incidents) && <div role="status" className="rounded-xl border border-[var(--border)] p-4 text-sm text-secondary">
      {errors.health && <p>{errors.health}</p>}{errors.incidents && <p>{errors.incidents}</p>}
    </div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {summary.signals.map((signal) => <div key={signal.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{signal.label}</p>
          <Badge tone={signal.state === "review" ? "warning" : "neutral"}>{signal.state === "review" ? "Review" : signal.state === "unavailable" ? "Unknown" : "Observed"}</Badge>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{signal.value === null ? "—" : signal.value}</p>
        <p className="mt-2 text-xs text-secondary">{signal.detail}</p>
      </div>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-secondary"/><h3 className="font-semibold">Recurring application incidents</h3></div>
        <p className="mt-2 text-xs text-secondary">Grouped from up to 40 most recent browser reports. Repeated reports are not unique customers, and these are not error rates.</p>
        {summary.incidents ? <>
          <p className="mt-3 text-sm text-secondary">{summary.incidents.observed} reports examined{summary.incidents.truncatedOrUnknown ? " · More may exist" : ""}</p>
          <div className="mt-2 divide-y divide-[var(--border-subtle)]">{summary.incidents.groups.slice(0, 6).map((group) => <div key={group.fingerprint} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate">{group.screen} · {group.errorClass}</span><span className="whitespace-nowrap text-secondary">{group.count} report{group.count === 1 ? "" : "s"}</span></div>)}</div>
          {!summary.incidents.groups.length && <p className="mt-3 text-sm text-secondary">No reports in the returned sample. Reporting may be disabled.</p>}
        </> : <p className="mt-4 text-sm text-secondary">Incident data unavailable.</p>}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-secondary"/><h3 className="font-semibold">Monitoring coverage</h3></div>
        <p className="mt-2 text-xs text-secondary">The health endpoint reads capped slices of these collections. A count of zero is not proof that no issue exists elsewhere.</p>
        <div className="mt-3 divide-y divide-[var(--border-subtle)]">
          {Object.entries(scope).map(([name, details]) => <div key={name} className="flex items-center justify-between gap-3 py-2 text-xs"><span>{name}</span><span className="text-secondary tabular-nums">{details.observed}/{details.limit} sampled{details.observed >= details.limit ? " · cap reached" : ""}</span></div>)}
        </div>
        {!Object.keys(scope).length && <p className="mt-3 text-sm text-secondary">No coverage details available.</p>}
      </div>
    </div>
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-secondary"/><h3 className="font-semibold">Release and financial guardrails</h3></div>
      <p className="mt-2 text-sm text-secondary">Live billing spend, cost per completed transaction, journey success rates and country-specific availability are not measured by this screen. Use the LX13 offline operational audit with verified, same-window billing and transaction exports, and the independent LX12 release-evidence gate. Stop conditions require operator review; this screen never disables a service.</p>
    </div>
  </section>;
}
