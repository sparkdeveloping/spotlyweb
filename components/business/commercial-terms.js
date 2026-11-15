"use client";

import { useEffect, useState } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { useToast } from "@/components/providers";

export function BusinessCommercialTerms({ businessId }) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    let active = true;
    setState(null); setAgree(false); setStatus("loading"); setError("");
    if (!businessId) return;
    authenticatedFetch(`/api/business/commercial-terms?businessId=${encodeURIComponent(businessId)}`)
      .then((response) => { if (active) { setState(response); setStatus("loaded"); } })
      .catch((caught) => { if (active) { setError(caught.message || "Pricing terms are unavailable."); setStatus("error"); } });
    return () => { active = false; };
  }, [businessId]);
  async function accept() {
    if (!state?.proposed?.fingerprint || !agree) return;
    setSaving(true);
    try {
      await authenticatedFetch("/api/business/commercial-terms", { method: "POST", body: JSON.stringify({ businessId, fingerprint: state.proposed.fingerprint }) });
      const next = await authenticatedFetch(`/api/business/commercial-terms?businessId=${encodeURIComponent(businessId)}`);
      setState(next); setAgree(false);
      toast("Your commercial agreement was saved and recorded.", { title: "Terms accepted" });
    } catch (caught) { toast(caught.message, { type: "error", title: "Could not accept terms" }); }
    finally { setSaving(false); }
  }
  if (status === "loading") return <Card className="p-5"><p className="text-sm text-secondary">Checking business commercial terms…</p></Card>;
  if (status === "error") return <Card className="p-5"><p className="font-semibold">Commercial terms are unavailable</p><p className="mt-2 text-sm text-secondary">{error}</p></Card>;
  return <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Spotly commercial terms</h2><Badge tone={state?.accepted ? "success" : "neutral"}>{state?.accepted ? "Agreement recorded" : "Existing terms remain"}</Badge></div>
    <p className="mt-2 text-sm leading-6 text-secondary">Current recorded Spotly commission: <strong>{Number(state?.activePercent || 0).toFixed(2)}%</strong> of the eligible order value. Customer delivery charges and payouts are calculated separately. Your historic transactions keep their original terms.</p>
    {state?.proposed && !state.proposalAccepted && <div className="mt-4 space-y-3 rounded-2xl border p-4"><p className="text-sm font-semibold">New terms available for your review</p><p className="text-sm leading-6 text-secondary">Proposed commission: <strong>{Number(state.proposed.commissionPercent).toFixed(2)}%</strong>. Your existing terms continue until an authorized business owner accepts this agreement. Review the full policy before deciding.</p>
      <a href={state.proposed.agreementUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-business underline underline-offset-4">Read commercial agreement</a>
      {state.canAccept && <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)}/><span>I am an authorized business owner, and I have reviewed and accept these terms (version {state.proposed.agreementVersion}).</span></label>}
      {state.canAccept && <Button disabled={!agree} loading={saving} onClick={accept}>Accept commercial terms</Button>}
    </div>}
    {state?.activationPending && <p className="mt-3 text-sm text-secondary">Your accepted agreement is recorded, but the new pricing system has not been activated. Existing billing terms remain in effect.</p>}
    {state?.acceptedAt && <p className="mt-3 text-xs text-secondary">Agreement accepted on {new Date(state.acceptedAt).toLocaleDateString()}.</p>}
    {state?.trial && <p className="mt-3 text-sm text-secondary">An eligible introductory commission waiver may apply under the published <a className="underline" href={state.trial.termsUrl} target="_blank" rel="noopener noreferrer">offer terms</a>. See your order statement for the actual waived commission.</p>}
  </Card>;
}
