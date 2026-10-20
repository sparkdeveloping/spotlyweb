"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, FileJson2, FolderCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { PortalShell } from "@/components/portal-shell";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { authenticatedFetch } from "@/lib/api-client";
import { AssistResearchPublication } from "@/components/admin-assist-research-publication";

export function AssistResearchImport() {
  const [manifest, setManifest] = useState(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [publicationBatch, setPublicationBatch] = useState("");
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

  async function refresh() {
    try {
      const data = await authenticatedFetch("/api/admin/assist-research");
      setBatches(data.batches || []);
    } catch (err) { setError(err.message || "Unable to load research batches."); }
  }
  useEffect(() => { refresh(); }, []);

  async function reconcileBatch(id) {
    setReviewBusy(true); setReviewError(""); setReview(null);
    try {
      const result = await authenticatedFetch("/api/admin/assist-research/review?batchId=" + encodeURIComponent(id));
      setReview(result);
    } catch (err) {
      setReviewError(err.message || "Could not compare this batch with current business listings.");
    } finally {
      setReviewBusy(false);
    }
  }
  async function readFile(event) {
    setError(""); setMessage(""); setPreview(null); setManifest(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 600000) { setError("File is too large. Use batches of at most 120 locations and 300 price references."); return; }
    try {
      const json = JSON.parse(await file.text());
      if (!Array.isArray(json.locations) || !Array.isArray(json.priceReferences)) {
        throw new Error("Choose a research_manifest.json containing locations and priceReferences arrays.");
      }
      if (json.locations.some(x => x.country !== "ZW")) throw new Error("Only Zimbabwe restaurant research belongs in this batch.");
      setManifest({ metadata: json.metadata || {}, locations: json.locations, priceReferences: json.priceReferences });
      setFileName(file.name);
    } catch (err) { setError(err.message || "Invalid research JSON."); }
  }
  async function submit(mode) {
    if (!manifest) return;
    setError(""); setMessage(""); setBusy(true);
    try {
      const response = await authenticatedFetch("/api/admin/assist-research", {
        method: "POST", body: JSON.stringify({ ...manifest, mode })
      });
      if (mode === "preview") setPreview(response);
      else {
        setMessage("Private Firestore research batch staged: " + response.id + ". Nothing was published or made orderable.");
        setPreview(null); await refresh();
      }
    } catch (err) { setError(err.message || "Could not stage research."); }
    finally { setBusy(false); }
  }
  return <AuthGate portal="admin" title="Sign in to Spotly Admin" sameOriginLogin><AdminAccess>
    <PortalShell portalId="admin" activeSection="marketplace">
      <main className="mx-auto max-w-[1040px] px-5 py-10">
        <Link href="/admin/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]"><ArrowLeft className="h-4 w-4"/>Marketplace</Link>
        <div className="mt-6 flex items-start gap-4">
          <span className="rounded-xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]"><Database className="h-6 w-6"/></span>
          <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Zimbabwe only</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Restaurant research to Firestore</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Save multi-brand restaurant research privately. Review sources, duplicates, copyright permissions and prices before promoting any listing.</p><Link href="/admin/assist-menu-launch" className="mt-4 inline-flex items-center rounded-xl border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)]">Activate verified restaurant menus →</Link>
          </div>
        </div>
        <div className="mt-7 rounded-2xl border bg-[var(--surface)] p-6 sm:p-8">
          <div className="flex items-center gap-3"><FileJson2 className="h-5 w-5 text-[var(--accent)]"/><h2 className="text-xl font-semibold">Upload research JSON</h2></div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">Extract the Zimbabwe research ZIP, then select <code>research_manifest.json</code>. The server accepts factual business names, locations, item names and reference prices—but rejects other countries and never writes to live products.</p>
          <label className="mt-5 block rounded-2xl border border-dashed p-5 text-sm font-semibold">Choose research file
            <input type="file" accept=".json,application/json" onChange={readFile} className="mt-3 block w-full text-sm font-normal"/>
          </label>
          {manifest&&<div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><p className="font-semibold">{fileName}</p><p className="mt-2 text-[var(--text-2)]">{manifest.locations.length} location candidates · {manifest.priceReferences.length} online price references</p></div>}
          {error&&<p role="alert" className="mt-5 rounded-xl border border-red-500/30 p-4 text-sm text-[var(--danger)]">{error}</p>}
          {message&&<p role="status" className="mt-5 rounded-xl border p-4 text-sm text-[var(--success)]">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={!manifest||busy} onClick={()=>submit("preview")} className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-40">{busy?"Reviewing…":"1. Validate and preview"}</button>
            {preview&&<button type="button" disabled={busy} onClick={()=>submit("stage")} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">2. Stage privately in Firestore</button>}
          </div>
          {preview&&<div className="mt-6 rounded-xl border p-5">
            <p className="flex items-center gap-2 font-semibold"><FolderCheck className="h-5 w-5 text-[var(--accent)]"/>Validated staging payload</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">{preview.locationCount} locations · {preview.priceCount} price references · {preview.distinctBrands?.length || 0} source names/brands</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">This preview does not check the entire canonical business database for duplicates. All records remain blocked from publication.</p>
          </div>}
        </div>
        <section className="mt-8 rounded-2xl border bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Private research batches</h2><button type="button" onClick={refresh} className="rounded-xl border p-2" aria-label="Refresh batches"><RefreshCw className="h-4 w-4"/></button></div>
          <div className="mt-4 space-y-3">{batches.map(b=><article key={b.id} className="rounded-xl bg-[var(--surface-2)] p-4 text-sm">
            <p className="font-semibold">{b.id}</p><p className="mt-1 text-xs text-[var(--text-2)]">{b.locationCount} locations · {b.priceCount} prices · {b.status} · {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-ZW"):""}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={reviewBusy} onClick={()=>reconcileBatch(b.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{reviewBusy ? "Comparing…" : "Check existing businesses & branches"}</button><button type="button" onClick={()=>{setPublicationBatch(b.id);reconcileBatch(b.id);}} className="rounded-lg border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">Review & publish</button></div>
          </article>)}{!batches.length&&<p className="text-sm text-[var(--text-2)]">No staged research batches yet.</p>}</div>
        </section>
        {publicationBatch && <AssistResearchPublication key={publicationBatch} batchId={publicationBatch} duplicateReport={review?.batchId===publicationBatch?review:null}/>}
        {reviewError && <p role="alert" className="mt-5 rounded-xl border p-4 text-sm text-[var(--danger)]">{reviewError}</p>}
        {review && <section className="mt-6 rounded-2xl border bg-[var(--surface)] p-6">
          <h2 className="text-xl font-semibold">Possible business duplicates</h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">Read-only comparison of {review.researchCount} staged locations with existing Spotly business and branch records.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-2xl font-semibold">{review.possibleMatches}</p><p className="text-xs text-[var(--text-2)]">Locations needing comparison</p></div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-2xl font-semibold">{review.strongMatches}</p><p className="text-xs text-[var(--text-2)]">Stronger potential matches</p></div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-2xl font-semibold">{review.citiesChecked?.length || 0}</p><p className="text-xs text-[var(--text-2)]">Cities searched</p></div>
          </div>
          <p className="mt-4 rounded-xl border p-4 text-xs leading-5 text-[var(--text-2)]">{review.warning} No result is cleared for publication, and menu prices are still unverified.</p>
          <div className="mt-5 max-h-[700px] space-y-3 overflow-y-auto">
            {(review.results || []).map(item=><article key={item.id} className="rounded-xl border p-4">
              <p className="font-semibold">{item.name}</p>
              <p className="mt-1 text-xs text-[var(--text-2)]">{item.city} · {item.area || item.address}</p>
              {item.existingCandidates.length ? <div className="mt-3 space-y-2">
                {item.existingCandidates.map(match=><div key={match.type+"_"+match.id} className="rounded-lg bg-[var(--surface-2)] p-3 text-xs">
                  <span className="font-semibold">{match.name}</span> · {match.type} · {match.rank.replaceAll("_"," ")}
                  <p className="mt-1 text-[var(--text-2)]">{match.address || match.city}</p>
                  <p className="mt-1 text-[var(--text-2)]">Claim: {match.claimStatus} · Verification: {match.verificationStatus}</p>
                  <p className="mt-1 text-[var(--text-2)]">{match.reasons.join(", ").replaceAll("_"," ")}</p>
                </div>)}
              </div> : <p className="mt-2 text-xs text-[var(--text-2)]">No candidate found in this limited city search. Manual review still required.</p>}
            </article>)}
          </div>
        </section>}
        <div className="mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm text-[var(--text-2)]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"/>
          <p>Staging never marks prices verified or makes businesses orderable. Existing merchants, business claims, customer payments and Driver dispatch are not modified. Malawi restaurant imports remain excluded.</p>
        </div>
      </main>
    </PortalShell>
  </AdminAccess></AuthGate>;
}
