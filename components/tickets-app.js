"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, MessageCircle, PhoneCall, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/firebase-provider";
import { authenticatedFetch } from "@/lib/api-client";
import { SpotlySupportAssistant } from "@/components/spotly-support-assistant";

const SUBJECTS = [
  { id: "account", label: "My account", description: "Sign-in, profile or verification" },
  { id: "orders", label: "An order or booking", description: "Bite, Shopper, Book and Live" },
  { id: "ride", label: "A ride or delivery", description: "Ride, Send and tracking" },
  { id: "business_claim", label: "My business", description: "Registration, claims and operations" },
  { id: "driver-job", label: "Driving with Spotly", description: "Driver access, documents and jobs" },
  { id: "payments", label: "A payment", description: "Charges, payouts and refunds" },
  { id: "safety", label: "A safety concern", description: "Something that needs careful attention" },
  { id: "general", label: "Something else", description: "A question or a problem" }
];

const statusText = {
  open: "Received", assigned: "With our team", waiting_for_spotly: "Waiting for Spotly",
  waiting_for_user: "Waiting for your reply", escalated: "Under review", resolved: "Resolved", closed: "Closed"
};
function friendlyError(error) {
  if (error?.status === 429) return "You've sent several requests. Please try again a little later.";
  if (error?.status === 401) return "Your session needs to be refreshed. Reload this page and try again.";
  if (error?.status === 403) return "This request belongs to a different session. Use the same browser or sign in to your account.";
  return "We couldn't complete that action. Check your connection and try again.";
}
const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";
const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7";

export function TicketsApp() {
  const params = useSearchParams();
  const { user, authReady, ensureAnonymousSession } = useAuth();
  const [cases, setCases] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("home");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reply, setReply] = useState("");
  const [phone, setPhone] = useState("");
  const [callbackConsent, setCallbackConsent] = useState(false);
  const [showCallback, setShowCallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const lastSeenUpdateRef = useRef(null);
  const previousUserRef = useRef(null);
  const incidentRef = String(params.get("incident") || params.get("reference") || "").trim();
  const safeIncident = /^SI-[0-9A-F]{12}$/.test(incidentRef) ? incidentRef : "";
  const requestedCase = String(params.get("case") || "").slice(0, 180);

  const refreshHistory = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const result = await authenticatedFetch("/api/support/conversations", { cache: "no-store" });
      setCases(result.conversations || []);
    } catch (reason) { setError(friendlyError(reason)); }
  }, [user?.uid]);

  const loadCase = useCallback(async (id, silent = false) => {
    if (!id || !user?.uid || busyRef.current) return;
    busyRef.current = true;
    if (!silent) setLoading(true);
    try {
      const result = await authenticatedFetch(`/api/support/conversations?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
      setActive(result.conversation);
      setMessages(result.messages || []);
      lastSeenUpdateRef.current = result.conversation?.updatedAt || null;
      if (!silent) { setMode("case"); setError(""); }
    } catch (reason) { if (!silent) setError(friendlyError(reason)); }
    finally { busyRef.current = false; if (!silent) setLoading(false); }
  }, [user?.uid]);

  useEffect(() => {
    const current = user?.uid || null;
    if (previousUserRef.current && previousUserRef.current !== current) {
      lastSeenUpdateRef.current = null;
      setActiveId(""); setActive(null); setMessages([]); setCases([]); setMode("home");
    }
    previousUserRef.current = current;
  }, [user?.uid]);
  useEffect(() => { if (authReady && user?.uid) refreshHistory(); }, [authReady, user?.uid, refreshHistory]);
  useEffect(() => { if (requestedCase && user?.uid && !activeId) setActiveId(requestedCase); }, [requestedCase, user?.uid, activeId]);
  useEffect(() => { if (activeId && user?.uid) loadCase(activeId); }, [activeId, user?.uid, loadCase]);
  useEffect(() => {
    if (!activeId || mode !== "case" || !user?.uid) return undefined;
    let checking = false, stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || checking || busyRef.current) return;
      checking = true;
      try {
        const result = await authenticatedFetch(`/api/support/conversations?conversationId=${encodeURIComponent(activeId)}&metadataOnly=1`, { cache: "no-store" });
        if (stopped) return;
        setActive(result.conversation);
        if (lastSeenUpdateRef.current !== result.conversation?.updatedAt) await loadCase(activeId, true);
      } catch { /* The existing messages stay available while temporarily offline. */ }
      finally { checking = false; }
    };
    const timer = window.setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [activeId, mode, user?.uid, loadCase]);

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const current = user || await ensureAnonymousSession();
      if (current.isAnonymous && (!name.trim() || !email.trim())) {
        setError("Add your name and email so the team has contact details."); return;
      }
      const result = await authenticatedFetch("/api/support/conversations", {
        method: "POST", body: JSON.stringify({
          action: "create", audience: current.isAnonymous ? "public" : "customer",
          name: name.trim(), email: email.trim(), category: topic || "general",
          subject: subject.trim(), message: message.trim(),
          ...(safeIncident ? { incidentReference: safeIncident } : {})
        })
      });
      setActive(null); setMessages([]); lastSeenUpdateRef.current = null;
      setActiveId(result.conversationId);
      setMode("case"); setNotice("Your request was received. Keep this browser signed in to follow replies.");
      setMessage(""); setSubject("");
      await refreshHistory();
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  async function send(event) {
    event.preventDefault(); if (busy || !reply.trim()) return;
    setBusy(true); setError("");
    try {
      await authenticatedFetch("/api/support/conversations", { method: "POST", body: JSON.stringify({ action: "message", conversationId: activeId, body: reply.trim() }) });
      setReply(""); setNotice("Your message was added to the request.");
      await loadCase(activeId);
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  async function requestCallback(event) {
    event.preventDefault(); if (busy) return;
    if (!callbackConsent) { setError("Please confirm that we may contact you at the number provided."); return; }
    setBusy(true); setError("");
    try {
      await authenticatedFetch("/api/support/conversations", { method: "POST", body: JSON.stringify({ action: "request_callback", conversationId: activeId, phone: phone.trim(), consent: true }) });
      setNotice("Callback requested. The team will review your request; a call time is not yet confirmed.");
      setShowCallback(false);
      await loadCase(activeId);
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  function openCase(id) { setNotice(""); setError(""); setActive(null); setMessages([]); lastSeenUpdateRef.current = null; setActiveId(id); setMode("case"); }
  function back() { setMode("home"); setActiveId(""); setActive(null); setMessages([]); setNotice(""); setError(""); }

  return <div className="min-h-screen bg-[var(--background)] text-[var(--text-1)]">
    <header className="border-b border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5 sm:px-8">
      <a href="https://spotlyafrica.com" className="text-base font-semibold tracking-[-.04em]">spotly<span className="text-[var(--accent)]">.</span></a>
      <span className="inline-flex items-center gap-2 text-xs font-medium text-secondary"><Headphones className="h-4 w-4" /> Help & support</span>
    </div></header>
    <main className="mx-auto max-w-4xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
      {mode === "home" ? <>
        <div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Spotly Support</p><h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-.055em] sm:text-5xl">How can we help?</h1><p className="mt-4 text-sm leading-7 text-secondary">Tell us what you need. Every request has a reference and a conversation you can return to.</p></div>
        <div className="mt-8"><SpotlySupportAssistant onHumanSupport={(category, question) => { setTopic(SUBJECTS.some((entry) => entry.id === category) ? category : "general"); setSubject(question ? question.slice(0, 180) : ""); setMessage(""); setNotice(""); setError(""); setMode("new"); }} /></div>
        <div className="mt-9 grid gap-3 sm:grid-cols-2">{SUBJECTS.map((item) => <button type="button" key={item.id} onClick={() => { setTopic(item.id); setSubject(""); setError(""); setMode("new"); }} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-left transition hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span><ArrowRight className="h-4 w-4 text-tertiary group-hover:text-[var(--accent)]" /></button>)}</div>
        <section className="mt-11"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold tracking-tight">Your requests</h2>{user?.uid ? <button type="button" onClick={refreshHistory} className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-[var(--accent)]"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button> : null}</div>
          {cases.length ? <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">{cases.map((item) => <button type="button" onClick={() => openCase(item.id)} key={item.id} className="flex w-full items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 text-left last:border-b-0 hover:bg-[var(--surface-2)]"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.subject}</span><span className="mt-1 block text-xs text-secondary">{item.id.slice(0, 8).toUpperCase()} · {statusText[item.status] || "In progress"}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-tertiary" /></button>)}</div> : <div className={`${panel} text-sm leading-6 text-secondary`}>No requests are linked to this browser session yet. You can create one above. Guest requests from another browser or Spotly subdomain may be tied to a different session. Return to the original page, or sign in to the original account.</div>}
        </section>
      </> : mode === "new" ? <>
        <button type="button" onClick={back} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-[var(--accent)]"><ArrowLeft className="h-4 w-4" /> Back to help topics</button>
        <h1 className="text-3xl font-semibold tracking-[-.045em]">Tell us what happened.</h1><p className="mt-3 max-w-xl text-sm leading-7 text-secondary">A short description is enough to start. Our team can ask for more details in the same conversation.</p>
        <form onSubmit={create} className={`${panel} mt-7 max-w-2xl space-y-5`}>
          <div className="text-xs font-semibold text-[var(--accent)]">{SUBJECTS.find((item) => item.id === topic)?.label || "General support"}</div>
          <label className="block"><span className="mb-2 block text-sm font-semibold">What's the problem?</span><input className={field} required minLength={3} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A brief summary" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">What were you trying to do?</span><textarea className={`${field} min-h-32 resize-y`} required minLength={1} maxLength={6000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened, and include an order or trip reference if you have one." /></label>
          {!user?.uid || user?.isAnonymous ? <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-semibold">Your name</span><input className={field} value={name} maxLength={160} onChange={(event) => setName(event.target.value)} required /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Your email</span><input type="email" className={field} value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} required /></label></div> : null}
          {safeIncident ? <p className="rounded-xl bg-[var(--surface-2)] p-3 text-xs text-secondary">App report attached as reference: <strong className="font-semibold">{safeIncident}</strong>. Our team can use this to look up the report.</p> : null}
          <p className="text-xs leading-5 text-secondary">Do not include passwords, PINs, one-time codes, payment credentials or exact live location. Sending a request shares the information above with Spotly Support.</p>
          <button type="submit" disabled={busy || !authReady} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50">{busy ? "Sending…" : "Send request"}<ArrowRight className="h-4 w-4" /></button>
        </form>
      </> : <>
        <button type="button" onClick={back} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-[var(--accent)]"><ArrowLeft className="h-4 w-4" /> All requests</button>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--accent)]">Support request {activeId.slice(0, 8).toUpperCase()}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.045em]">{active?.subject || "Your support request"}</h1><p className="mt-2 text-sm text-secondary">{statusText[active?.status] || "Loading status…"} · Replies are saved here.</p></div><button type="button" onClick={() => loadCase(activeId)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
        <div className={`${panel} mt-7`}>
          <div className="space-y-4" aria-live="polite">{messages.map((item) => <div key={item.id} className={`flex ${item.senderRole === "support" ? "justify-start" : "justify-end"}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${item.senderRole === "support" ? "bg-[var(--surface-2)]" : "bg-[var(--accent-soft)]"}`}><p className="text-[11px] font-semibold text-secondary">{item.senderRole === "support" ? "Spotly Support" : "You"}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.body}</p></div></div>)}{loading && !messages.length ? <p className="text-sm text-secondary">Loading your request…</p> : !messages.length ? <p className="text-sm text-secondary">This request has no public messages yet.</p> : null}</div>
          {active?.status !== "closed" ? <form onSubmit={send} className="mt-7 border-t border-[var(--border-subtle)] pt-5"><label htmlFor="ticket-reply" className="mb-2 block text-sm font-semibold">Add a reply</label><textarea id="ticket-reply" className={`${field} min-h-24`} value={reply} maxLength={6000} onChange={(event) => setReply(event.target.value)} placeholder="Anything else we should know?" /><button type="submit" disabled={busy || !reply.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50">Send reply <Send className="h-4 w-4" /></button></form> : <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-sm text-secondary">This request is closed. You can start another request if you still need help.</p>}
        </div>
        <div className={`${panel} mt-5`}><div className="flex items-center gap-3"><PhoneCall className="h-5 w-5 text-[var(--accent)]" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Prefer a phone call?</h2><p className="mt-1 text-xs leading-5 text-secondary">Ask our team to call. Availability and timing are not guaranteed.</p></div>{active?.callbackStatus ? <span className="text-xs font-semibold text-secondary">{active.callbackStatus.replaceAll("_", " ")}</span> : <button type="button" onClick={() => setShowCallback(!showCallback)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Request call</button>}</div>
          {showCallback && !active?.callbackStatus ? <form onSubmit={requestCallback} className="mt-5 space-y-3"><label className="block"><span className="mb-2 block text-sm font-semibold">Phone number with country code</span><input type="tel" className={field} value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={7} maxLength={24} placeholder="+263 … or +265 …" /></label><label className="flex items-start gap-3 text-xs leading-5 text-secondary"><input className="mt-1" type="checkbox" checked={callbackConsent} onChange={(event) => setCallbackConsent(event.target.checked)} required />I agree to be contacted by Spotly Support at this number about this request.</label><button disabled={busy} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)]">Confirm callback request</button></form> : null}
        </div>
      </>}
      {notice ? <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />{notice}</div> : null}
      {error ? <p role="alert" className="mt-5 rounded-xl border border-[var(--danger)] px-4 py-3 text-sm">{error}</p> : null}
      <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 text-xs text-secondary"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Private to this signed-in or guest session</span><span className="flex gap-4"><a className="underline" href="https://spotlyafrica.com/privacy">Privacy</a><a className="underline" href="https://spotlyafrica.com/terms">Terms</a><a className="underline" href="https://spotlyafrica.com/support">Help centre</a></span></footer>
    </main>
  </div>;
}
