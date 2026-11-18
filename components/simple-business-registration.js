"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Building2, ShieldCheck } from "lucide-react";
import { publicApiFetch } from "@/lib/api-client";
import { useAuth } from "@/components/firebase-provider";
import { spotlyPortalUrl } from "@/lib/spotly-domains";
import { SPOTLY_COUNTRIES, countryDefinition } from "@/lib/country-engine";
import { businessCategories } from "@/data/business-config";
import { savePendingRegistration } from "@/lib/business-registration-continuation-client.mjs";
import { CONTACT_PREFERENCE_OPTIONS, REGISTRATION_STATUS_OPTIONS } from "@/lib/business-registrations.mjs";

const initial={applicantName:"",businessName:"",phone:"",email:"",roleAtBusiness:"owner",contactPreference:"whatsapp",registrationStatus:"not_registered",category:businessCategories[0]||"Other",country:"ZW",city:"",notes:"",contactConsent:false};
export function SimpleBusinessRegistration({initialName=""}){
 const {user}=useAuth();
 const [form,setForm]=useState({...initial,businessName:initialName});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState(null);
 const attempt=useRef(null);
 const country=countryDefinition(form.country);
 useEffect(()=>{if(user&&!user.isAnonymous)setForm(prev=>({...prev,applicantName:prev.applicantName||user.displayName||"",email:prev.email||user.email||""}));},[user]);
 function edit(field,value){setForm(prev=>({...prev,[field]:value,...(field==="country"?{city:""}:{})}));setError("");attempt.current=null;}
 async function submit(e){e.preventDefault();if(busy)return;
  if(!form.contactConsent){setError("Please confirm we may contact you about this application.");return;}
  if(!form.city.trim()||!form.applicantName.trim()||!form.businessName.trim()||!form.phone.trim()){setError("Enter your name, business, phone and city.");return;}
  if(form.contactPreference==="email"&&!form.email.trim()){setError("Enter an email address to receive an email reply.");return;}
  setBusy(true);setError("");
  try{attempt.current ||= crypto.randomUUID();const payload=await publicApiFetch("/api/public/business-registrations",{method:"POST",body:JSON.stringify({...form,idempotencyKey:attempt.current})});setReceipt(payload);if(payload.registrationId)savePendingRegistration(window.sessionStorage,payload.registrationId,attempt.current);}
  catch(err){setError(err.message||"Your request wasn't confirmed. Try again; we won't create a duplicate if it was already received.");}
  finally{setBusy(false);}
 }
 const field=(label,key,type="text",required=true)=> <label className="block text-sm font-semibold"><span>{label}</span><input className="field-control mt-2 w-full" type={type} value={form[key]} required={required} onChange={e=>edit(key,e.target.value)}/></label>;
 return <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text)] sm:py-16"><div className="mx-auto max-w-2xl">
  <Link href={spotlyPortalUrl("business", "/")} className="inline-flex items-center gap-2 text-sm font-semibold text-business"><Building2 className="h-5 w-5"/>Spotly Business</Link>
  {receipt?<section role="status" className="mt-12 rounded-[28px] border bg-[var(--surface)] p-8 sm:p-12"><CheckCircle2 className="h-12 w-12 text-business"/><h1 className="mt-5 text-3xl font-bold">Registration received.</h1><p className="mt-3 text-secondary">We've received your interest. Our team will follow up through your preferred contact method. Your business is not yet verified or published.</p><p className="mt-4 text-sm text-secondary">Continue on this device to carry your details into the verification journey. You may need to sign in first. Your business still requires approval.</p><p className="mt-5 text-xs text-secondary">Reference: <span className="font-mono">{receipt.registrationId}</span></p><div className="mt-7 flex flex-wrap gap-3"><Link className="rounded-xl bg-business px-5 py-3 font-bold text-[var(--on-accent)]" href={spotlyPortalUrl("business", "/")}>Back to Business</Link><Link href={spotlyPortalUrl("business", "/get-started/verify?name=" + encodeURIComponent(form.businessName))} className="rounded-xl border px-5 py-3 font-semibold">Continue to verification</Link></div></section>
  :<><div className="mt-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-business">Start with the basics</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Your business starts here.</h1><p className="mt-4 max-w-lg leading-7 text-secondary">Tell us a little about your business. We'll help with verification and setup when you're ready.</p></div>
  <form onSubmit={submit} className="mt-8 space-y-7 rounded-[28px] border bg-[var(--surface)] p-5 sm:p-9">
   <div className="grid gap-5 sm:grid-cols-2">{field("Your name","applicantName")}{field("Business name","businessName")}{field("Phone or WhatsApp","phone","tel")}{field("Email (optional)","email","email",false)}</div>
   <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">How should we reach you?<select className="field-control mt-2 w-full" value={form.contactPreference} onChange={e=>edit("contactPreference",e.target.value)}>{CONTACT_PREFERENCE_OPTIONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
   <label className="text-sm font-semibold">Your role<select className="field-control mt-2 w-full" value={form.roleAtBusiness} onChange={e=>edit("roleAtBusiness",e.target.value)}>{[["owner","Owner"],["manager","Manager"],["authorized_representative","Authorized representative"],["other","Other"]].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
   <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Country<select className="field-control mt-2 w-full" value={form.country} onChange={e=>edit("country",e.target.value)}>{SPOTLY_COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label className="text-sm font-semibold">City or town<input className="field-control mt-2 w-full" list="business-cities" value={form.city} onChange={e=>edit("city",e.target.value)} required/><datalist id="business-cities">{(country?.cities||[]).map(c=><option key={c.id} value={c.name}/>)}</datalist></label></div>
   <details className="rounded-xl bg-[var(--surface-2)] p-4"><summary className="cursor-pointer font-semibold">A couple more details (optional)</summary><div className="mt-5 space-y-4"><label className="block text-sm font-semibold">Business category<select className="field-control mt-2 w-full" value={form.category} onChange={e=>edit("category",e.target.value)}>{businessCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className="block text-sm font-semibold">Registration status<select className="field-control mt-2 w-full" value={form.registrationStatus} onChange={e=>edit("registrationStatus",e.target.value)}>{REGISTRATION_STATUS_OPTIONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label className="block text-sm font-semibold">Anything else?<textarea maxLength={1000} className="field-control mt-2 w-full" value={form.notes} onChange={e=>edit("notes",e.target.value)}/></label></div></details>
   <label className="flex items-start gap-3 text-sm leading-6 text-secondary"><input className="mt-1 h-5 w-5 shrink-0 accent-business" type="checkbox" checked={form.contactConsent} onChange={e=>edit("contactConsent",e.target.checked)} required/><span>I agree Spotly may contact me about my Business registration. See our <Link href="/privacy" className="underline">Privacy notice</Link> and <Link href="/terms" className="underline">Terms</Link>. This request does not activate payments or publish my business.</span></label>
   {error?<p role="alert" className="rounded-xl bg-[var(--warning-soft)] p-3 text-sm text-[var(--on-warning-soft)]">{error}</p>:null}
   <button disabled={busy} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-business px-5 py-3 font-bold text-[var(--on-accent)] disabled:opacity-60">{busy?"Sending securely…":"Send request"}<ArrowRight className="h-4 w-4"/></button>
   <p className="flex items-center gap-2 text-xs text-secondary"><ShieldCheck className="h-4 w-4"/>No documents needed for this initial request.</p>
  </form><p className="mt-6 text-center text-sm text-secondary">Already have a verified Business account? <Link href={spotlyPortalUrl("business", "/")} className="font-semibold text-business">Sign in</Link></p></>}
 </div></main>;
}
