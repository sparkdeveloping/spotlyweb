"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import { Badge, Button, SectionCard } from "@/components/ui";

const tone = {
  ready: "success",
  blocked: "danger",
  needs_verification: "warning",
  not_configured: "neutral"
};

function label(state) {
  if (state === "ready") return "Ready";
  if (state === "blocked") return "Blocked";
  if (state === "needs_verification") return "Needs verification";
  return "Not configured";
}

function StateIcon({ state }) {
  if (state === "ready") return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (state === "blocked") return <AlertTriangle className="h-5 w-5 text-danger" />;
  return <CircleDashed className="h-5 w-5 text-warning" />;
}

export function AdminLaunchReadiness() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await authenticatedFetch("/api/admin/launch-readiness"));
    } catch (caught) {
      setError(caught.message || "Launch readiness could not be checked.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return <SectionCard title="Pilot launch gates" description="Operational checks based on current platform settings and safe environment signals. A configured value is not treated as proof unless it can be verified here.">
    {loading && <div className="p-5 text-sm text-secondary">Checking the current environment…</div>}
    {!loading && error && <div className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-danger">{error}</p><Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" />Retry</Button></div>}
    {!loading && data && <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <p className="text-sm text-secondary">{data.summary.ready} of {data.summary.total} gates currently report ready. External legal, staffing, provider, rules, monitoring, and backup verification may still be required.</p>
        <Badge tone={data.summary.blocked ? "danger" : data.summary.ready === data.summary.total ? "success" : "warning"}>{data.summary.blocked ? `${data.summary.blocked} blocked` : `${data.summary.ready}/${data.summary.total} ready`}</Badge>
      </div>
      <div className="divide-y">
        {data.checks.map((check) => <div key={check.id} className="flex items-start gap-4 p-5">
          <StateIcon state={check.state} />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{check.label}</p><Badge tone={tone[check.state] || "neutral"}>{label(check.state)}</Badge></div><p className="mt-1 text-sm leading-6 text-secondary">{check.detail}</p></div>
        </div>)}
      </div>
    </div>}
  </SectionCard>;
}
