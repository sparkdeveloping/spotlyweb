"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/api-client";
const OPTIONS = [
  ["browseEnabled","Show independent catalogues","Customers can browse Spotly’s request catalogues."],
  ["requestEnabled","Accept order requests","Send customer baskets to Assist Operations for a confirmed quote."],
  ["enabled","Independent purchasing finance","Use the independent purchase ledger and payment workflow."],
  ["providerReviewed","Paynow purchasing review complete","Confirm that your USD payment setup has been reviewed for independent purchases."],
  ["manualFloatAttestationEnabled","Purchasing float reconciliation","Finance can record evidence of confirmed shopper purchasing funds."],
  ["driverDispatchEnabled","Shopper fulfilment","Allow vetted shopper assignments after payment and float checks."],
  ["refundReconciliationEnabled","Refund reconciliation","Finance can submit and separately verify returned customer funds."],
  ["closeoutEnabled","Finance closeout","Reconcile shopper float, purchase receipts and refunds."],
  ["paymentCollectionEnabled","Collect approved quote payments","Customers can pay a current accepted quote at a location marked financially ready."]
];
export function AdminAssistConfiguration() {
  const [data,setData]=useState(null),[form,setForm]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{let active=true;authenticatedFetch("/api/admin/assist-configuration").then(result=>{if(active){setData(result);setForm(result.configuration);}}).catch(failure=>{if(active)setError(failure.message);});return()=>{active=false;};},[]);
  async function save(event){event.preventDefault();setBusy(true);setError("");setNotice("");try{await authenticatedFetch("/api/admin/assist-configuration",{method:"PATCH",body:JSON.stringify(form)});setNotice("Assist settings saved. Each order still follows its quote, payment and shopper stages.");}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  return <section className="mt-6 max-w-3xl rounded-2xl border bg-[var(--surface)] p-5 sm:p-7"><h2 className="text-xl font-semibold">Order service settings</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Manage catalogue browsing, order intake and the independent purchase workflow. Location opt-outs and regional coverage still apply.</p>{error?<p role="alert" className="mt-4 text-sm text-[var(--danger)]">{error}</p>:null}{notice?<p role="status" className="mt-4 text-sm text-[var(--success)]">{notice}</p>:null}{!data?<p role="status" className="mt-5 text-sm">Loading service settings…</p>:<form onSubmit={save}><p className="mt-5 rounded-xl bg-[var(--surface-2)] p-4 text-sm">Paynow USD: <strong>{data.providerConfigured?"Configured":"Needs configuration"}</strong>. <Link href="/admin/settings" className="font-semibold text-[var(--accent)]">Platform integrations →</Link></p><div className="mt-4 divide-y divide-[var(--border-subtle)]">{OPTIONS.map(([key,label,description])=><label key={key} className="flex cursor-pointer items-start gap-3 py-4"><input type="checkbox" checked={form[key]===true} onChange={event=>setForm(current=>({...current,[key]:event.target.checked}))} disabled={!data.canConfigure||busy} className="mt-1 h-4 w-4"/><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[var(--text-2)]">{description}</span></span></label>)}</div>{data.canConfigure?<button disabled={busy} className="mt-4 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Save service settings"}</button>:<p className="mt-4 text-sm text-[var(--text-2)]">A platform administrator can change these settings.</p>}</form>}</section>;
}
