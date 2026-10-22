"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, ImageIcon, RefreshCw, ShieldAlert, Search } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { PortalShell } from "@/components/portal-shell";
import { authenticatedFetch } from "@/lib/api-client";
import snapshot from "@/data/themenu/image-candidates-2026-10-21.json";

function PreviewPhoto({image}) {
  const [failed,setFailed]=useState(false);
  return <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
    <div className="relative aspect-[4/3] bg-[var(--surface-2)]">
      {!failed
        ? <img src={image.imageUrl} alt={image.alt || "The Menu photograph candidate"} loading="lazy" referrerPolicy="no-referrer"
          onError={()=>setFailed(true)} className="h-full w-full object-cover"/>
        : <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-secondary"><ImageIcon className="h-7 w-7"/>Image unavailable at the source. Check the original page.</div>}
      <span className="absolute left-2 top-2 rounded-full bg-amber-950/85 px-2.5 py-1 text-[10px] font-semibold text-white">Rights not cleared</span>
    </div>
    <div className="space-y-1 p-3 text-xs">
      <p className="font-semibold capitalize">{image.kind} candidate</p>
      <p className="line-clamp-2 text-secondary">{image.alt||"No original image caption"}</p>
      <a href={image.sourcePage} rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-1 font-semibold text-[var(--accent)]">Inspect source <ExternalLink className="h-3 w-3"/></a>
    </div>
  </article>;
}

export function TheMenuImageResearch() {
  const [list,setList]=useState(()=>{
    const combined=[...snapshot.listingCandidates.map(item=>({name:item.name,sourcePage:item.sourcePage})),
      ...snapshot.detailedPages.map(item=>({name:item.restaurant,sourcePage:item.sourcePage}))];
    return combined.filter((item,index)=>combined.findIndex(other=>other.sourcePage===item.sourcePage)===index);
  });
  const [selected,setSelected]=useState("");
  const [search,setSearch]=useState("");
  const [record,setRecord]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const shown=useMemo(()=>list.filter(item=>item.name.toLowerCase().includes(search.trim().toLowerCase())),[list,search]);
  useEffect(()=>{
    authenticatedFetch("/api/admin/themenu-images",{cache:"no-store"}).then(data=>{
      if(data?.candidates?.length)setList(data.candidates);
    }).catch(()=>{});
  },[]);
  async function inspect(page){
    setSelected(page);setRecord(null);setBusy(true);setError("");
    try{
      const data=await authenticatedFetch("/api/admin/themenu-images?page="+encodeURIComponent(page),{cache:"no-store"});
      setRecord(data.record);
    }catch(err){setError(err.message||"Source images could not be inspected.");}
    finally{setBusy(false);}
  }
  return <AuthGate portal="admin" title="Sign in to Spotly Admin" sameOriginLogin><AdminAccess>
    <PortalShell portalId="admin" activeSection="marketplace">
      <main className="mx-auto max-w-[1220px] px-4 py-8 sm:px-6">
        <Link href="/admin/assist-research" className="text-sm font-semibold text-[var(--accent)]">← Restaurant research</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Spotly editorial studio · Private</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">The Menu image catalog</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Real restaurant image references collected from The Menu for a source and permissions review. These photographs have not been published to Spotly or approved as merchant-owned media.</p>
          </div>
          <a href="https://github.com/sparkdeveloping/spotlyweb/actions/workflows/themenu-image-review.yml" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Private review bundle <ExternalLink className="h-4 w-4"/></a>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[var(--surface-2)] p-4 text-xs leading-6">
          <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-warning"/>
          <div><p className="font-semibold">Permission boundary</p><p>Some source photos are credited to Google Maps, Facebook or individual photographers. The signed The Menu grant covers only photographs The Menu has authority to license. Inspect source credit and obtain matching usage evidence before storing or publishing an image. This screen makes no operational or Firebase changes.</p></div>
        </div>
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3"><Search className="h-4 w-4 text-secondary"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search restaurants…" className="h-11 w-full min-w-0 bg-transparent text-sm outline-none" aria-label="Find a restaurant"/></div>
            <p className="my-3 px-2 text-xs font-medium text-secondary">{shown.length} source restaurant pages</p>
            <div className="max-h-[620px] space-y-1 overflow-y-auto">{shown.map(item=><button key={item.sourcePage} type="button" onClick={()=>inspect(item.sourcePage)} className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${selected===item.sourcePage?"bg-[var(--accent-soft)] font-semibold text-[var(--accent)]":"hover:bg-[var(--surface-2)]"}`}>{item.name}</button>)}</div>
          </section>
          <section className="min-h-[300px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5" aria-live="polite">
            {busy?<div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-secondary"><RefreshCw className="h-4 w-4 animate-spin"/>Checking The Menu source page…</div>
            :error?<div role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</div>
            :record?<><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{record.name}</h2><p className="mt-1 text-sm text-secondary">{record.imageReferences.length} images located · source review required</p></div><a href={record.sourcePage} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--accent)]">Original restaurant listing ↗</a></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{record.imageReferences.map(image=><PreviewPhoto key={image.imageUrl} image={image}/>)}</div>
              {record.imageReferences.length===0&&<p className="mt-6 text-sm text-secondary">No directly readable restaurant photos were found on this source page.</p>}
              <p className="mt-5 text-xs leading-6 text-secondary">Source-credit excerpts: {record.sourcePhotoCredits.join(" · ")||"Not available. Check source manually."}</p>
            </>:<div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-secondary"><ImageIcon className="h-9 w-9"/>Choose a restaurant to inspect its actual source image references.</div>}
          </section>
        </div>
      </main>
    </PortalShell>
  </AdminAccess></AuthGate>;
}
