"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  ExternalLink,
  Headphones,
  HelpCircle,
  MessageCircle,
  Paperclip,
  PlayCircle,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Overlay, SearchField, StatusBadge } from "@/components/ui";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import {
  closeSupportConversation,
  createSupportConversation,
  reopenSupportConversation,
  rateSupportConversation,
  sendSupportMessage,
  subscribeHelpResources,
  subscribeSupportConversations,
  subscribeSupportMessages,
  track,
  uploadSupportAttachment
} from "@/lib/firebase-services";
import { readState, removeState, writeState } from "@/lib/browser-state";

const defaultResources = [
  { id: "claim", title: "How business claiming works", description: "Search, confirm, verify ownership, and continue setup without starting from zero.", category: "Business setup", type: "guide", language: "en", audience: ["public", "business"] },
  { id: "branches", title: "Organizing brands and branches", description: "Understand organizations, business brands, branches, branch managers, and shared settings.", category: "Business setup", type: "guide", language: "en", audience: ["business"] },
  { id: "pickup", title: "Preparing grocery pickup", description: "Configure products, availability, substitution choices, pickup slots, and order handover.", category: "Commerce", type: "guide", language: "en", audience: ["business"] },
  { id: "verification", title: "Documents and verification", description: "What Spotly may request and how to respond when more information is needed.", category: "Trust & safety", type: "guide", language: "en", audience: ["business"] },
  { id: "support", title: "Getting useful support", description: "Open a conversation, include context, and follow status updates without losing the history.", category: "Support", type: "guide", language: "en", audience: ["public", "business"] }
];

function ChatPanel({ onClose, context = {} }) {
  const { user, ensureAnonymousSession } = useAuth();
  const { settings } = usePlatform();
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const allowedCategories = ["business_claim", "onboarding", "account", "orders", "payments", "partnership", "safety", "driver-job", "staff-task", "privacy"];
  const initialCategory = allowedCategories.includes(context.topic) ? context.topic : "general";
  const initialSubject = context.subject || (context.topic ? context.topic.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "");
  const [form, setForm] = useState({ name: user?.displayName || "", email: user?.email || "", subject: initialSubject, category: initialCategory, message: "" });
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const [rating, setRating] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    const saved = readState("spotly-support-conversation", user, "", "session");
    if (saved) setConversationId(saved);
  }, [user?.uid]);
  useEffect(() => {
    if (!conversationId) return undefined;
    return subscribeSupportMessages(conversationId, setMessages, (error) => toast(error.message, { type: "error", title: "Conversation unavailable" }));
  }, [conversationId]);
  useEffect(() => {
    if (!conversationId || !user?.uid) return undefined;
    return subscribeSupportConversations((items) => setConversation(items.find((item) => item.id === conversationId) || null), { requesterId: user.uid, limit: 50, onError: () => {} });
  }, [conversationId, user?.uid]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function start(event) {
    event.preventDefault(); setLoading(true);
    try {
      const sessionUser = user || await ensureAnonymousSession();
      const id = await createSupportConversation({
        ...form,
        audience: sessionUser.isAnonymous ? "public" : "customer",
        contextType: context.contextType || (context.reference ? form.category : null),
        contextId: context.reference || context.contextId || null,
        businessId: context.businessId || null,
        context: { orderId: context.orderId || null, claimId: context.claimId || null, paymentId: context.paymentId || null, jobId: context.jobId || null, taskId: context.taskId || null }
      }, sessionUser);
      writeState("spotly-support-conversation", sessionUser, id, "session");
      setConversationId(id);
      setForm((current) => ({ ...current, message: "" }));
    } catch (error) { toast(error.message, { type: "error", title: "Could not start conversation" }); }
    finally { setLoading(false); }
  }

  async function send(event) {
    event.preventDefault();
    if (!reply.trim() && !attachment) return;
    const body = reply.trim() || "Attachment added";
    setLoading(true);
    try {
      let attachments = [];
      if (attachment) {
        if (!["image/jpeg", "image/png", "application/pdf", "text/plain"].includes(attachment.type)) throw new Error("Choose a JPG, PNG, PDF or text file.");
        if (attachment.size > 10 * 1024 * 1024) throw new Error("Attachments must be smaller than 10 MB.");
        attachments = [await uploadSupportAttachment(conversationId, attachment, user?.uid, setAttachmentProgress)];
      }
      await sendSupportMessage(conversationId, body, user, { senderName: form.name || "Visitor", senderRole: user ? "customer" : "public", attachments, context });
      setReply(""); setAttachment(null); setAttachmentProgress(0);
    } catch (error) { toast(error.message, { type: "error", title: "Message not sent" }); }
    finally { setLoading(false); }
  }

  async function toggleClosed() {
    setLoading(true);
    try {
      if (conversation?.status === "closed") await reopenSupportConversation(conversationId, user);
      else await closeSupportConversation(conversationId, user);
      toast(conversation?.status === "closed" ? "Conversation reopened." : "Conversation closed.", { title: "Support updated" });
    } catch (error) { toast(error.message, { type: "error", title: "Could not update conversation" }); }
    finally { setLoading(false); }
  }

  function startNew() {
    removeState("spotly-support-conversation", user, "session");
    setConversationId(""); setConversation(null); setMessages([]); setReply(""); setAttachment(null); setRating("");
  }

  return <Overlay open onClose={onClose} mode="drawer" title="Message Spotly Support" description={settings.support?.hours || "Your conversation keeps its history and reference."} className="w-full max-w-[440px]">
    <div className="flex h-full min-h-0 flex-col">{conversationId ? <><div className="flex flex-wrap items-center gap-2 border-b p-4"><div className="min-w-0 flex-1"><p className="font-semibold">Reference {conversationId.slice(0, 8).toUpperCase()}</p><div className="mt-1 flex items-center gap-2"><StatusBadge status={conversation?.status || "open"} /><span className="text-xs text-secondary">{conversation?.assignedTo ? "Assigned" : "Waiting for assignment"}</span></div></div><Button size="sm" variant="outline" onClick={toggleClosed} loading={loading}>{conversation?.status === "closed" ? "Reopen" : "Close"}</Button></div><div className="min-h-0 flex-1 overflow-y-auto bg-grouped p-4"><div className="mb-4 rounded-xl border bg-[var(--surface)] p-3 text-xs leading-5 text-secondary">We will reply here. Do not send passwords, one-time codes, PINs or complete payment credentials.</div><div className="space-y-3">{messages.filter((message) => !message.internal).map((message) => { const mine = message.senderId === user?.uid || (!message.senderId && message.senderRole === "public"); return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 ${mine ? "bg-violet text-[var(--on-accent)]" : "border bg-[var(--surface)]"}`}><p className={`text-[11px] font-semibold ${mine ? "text-[color-mix(in_srgb,var(--on-accent)_65%,transparent)]" : "text-tertiary"}`}>{message.senderName || (mine ? "You" : "Spotly Support")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>{message.attachments?.length > 0 && <div className="mt-2 space-y-1">{message.attachments.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className={`block text-xs font-semibold underline ${mine ? "text-[var(--on-accent)]" : "text-violet"}`}>{item.name}</a>)}</div>}</div></div>; })}{!messages.length && <p className="py-10 text-center text-sm text-secondary">Loading conversation…</p>}</div><div ref={endRef} /></div>{conversation?.status === "closed" ? <div className="space-y-3 border-t p-4"><p className="text-sm font-semibold">Was this resolved?</p><div className="flex gap-2">{["Yes", "Partly", "No"].map((value) => <Button key={value} size="sm" variant={rating === value ? "secondary" : "outline"} onClick={async () => { setRating(value); try { await rateSupportConversation(conversationId, value.toLowerCase(), user); } catch (error) { toast(error.message || "Feedback could not be saved.", { type: "error" }); } }}>{value}</Button>)}</div><Button variant="ghost" size="sm" onClick={startNew}>Start another conversation</Button></div> : <form onSubmit={send} className="space-y-2 border-t bg-[var(--surface)] p-3"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type your message…" rows={2} className="min-h-12 max-h-28 w-full resize-y rounded-xl bg-grouped px-3 py-3 text-sm outline-none" /><div className="flex items-center gap-2"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold"><Paperclip className="h-4 w-4" />{attachment ? attachment.name : "Attach"}<input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf,text/plain" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>{attachmentProgress > 0 && attachmentProgress < 100 && <span className="text-xs text-secondary">{attachmentProgress}%</span>}<span className="flex-1" /><Button type="submit" size="sm" loading={loading}><Send className="h-4 w-4" />Send</Button></div></form>}</> : <form onSubmit={start} className="space-y-4 overflow-y-auto p-5"><div className="rounded-xl bg-violet-soft p-4"><p className="text-sm font-semibold text-violet-strong">Start with useful context</p><p className="mt-1 text-xs leading-5 text-secondary">Include the business, order, claim, payment, job or task reference when available.</p></div>{context.reference && <div className="rounded-xl border p-3 text-sm"><span className="text-secondary">Linked reference</span><p className="mt-1 font-semibold">{context.reference}</p></div>}{!user && <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold">Name</span><input required className="surface h-11 w-full rounded-xl px-3 text-sm outline-none" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-1.5 block text-xs font-semibold">Email</span><input required type="email" className="surface h-11 w-full rounded-xl px-3 text-sm outline-none" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>}<label className="block"><span className="mb-1.5 block text-xs font-semibold">What do you need help with?</span><select className="surface h-11 w-full rounded-xl px-3 text-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="general">General question</option><option value="business_claim">Business claim</option><option value="onboarding">Business onboarding</option><option value="account">Account access</option><option value="orders">Orders and pickup</option><option value="payments">Payments and finance</option><option value="driver-job">Driver training or job</option><option value="staff-task">Staff task</option><option value="safety">Safety or urgent concern</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Subject</span><input required className="surface h-11 w-full rounded-xl px-3 text-sm outline-none" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A short summary" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Message</span><textarea required className="surface min-h-28 w-full rounded-xl p-3 text-sm outline-none" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="What were you trying to do, and what happened?" /></label><Button type="submit" loading={loading} className="w-full">Start conversation<ArrowRight className="h-4 w-4" /></Button></form>}</div>
  </Overlay>;
}


export function SupportApp() {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic") || searchParams.get("subject") || "";
  const supportContext = { topic: requestedTopic, subject: searchParams.get("subject") || "", reference: searchParams.get("reference") || searchParams.get("order") || searchParams.get("claim") || searchParams.get("payment") || searchParams.get("job") || searchParams.get("task") || "", businessId: searchParams.get("business") || "", orderId: searchParams.get("order") || "", claimId: searchParams.get("claim") || "", paymentId: searchParams.get("payment") || "", jobId: searchParams.get("job") || "", taskId: searchParams.get("task") || "" };
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState(defaultResources);
  const [chatOpen, setChatOpen] = useState(Boolean(requestedTopic));
  const language = "en";
  const { settings } = usePlatform();

  useEffect(() => {
    track("help_center_viewed");
    let unsubscribe;
    try { unsubscribe = subscribeHelpResources((items) => { if (items.length) setResources(items.filter((item) => item.published !== false)); }, { audience: "public", onError: () => {} }); } catch {}
    return () => unsubscribe?.();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return resources.filter((item) => (!term || [item.title, item.description, item.category].join(" ").toLowerCase().includes(term)) && (item.language === language || item.language === "all" || language === "en" && !item.language));
  }, [query, resources, language]);

  return <main className="min-h-screen bg-grouped text-ink"><header className="border-b bg-[var(--surface)]"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="Spotly" width={42} height={42} /><span className="font-semibold">Spotly Support</span></Link><Button onClick={() => setChatOpen(true)}><MessageCircle className="h-4 w-4" />Contact support</Button></div></header><section className="border-b bg-[var(--surface)] px-4 py-14 sm:px-6 lg:py-20"><div className="mx-auto max-w-4xl text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-violet-soft text-violet"><HelpCircle className="h-7 w-7" /></span><h1 className="mt-6 text-4xl font-semibold tracking-[-.04em] text-ink sm:text-5xl">What are you trying to get done?</h1><p className="mx-auto mt-4 max-w-2xl leading-7 text-secondary">Search practical guidance or start a support conversation. Empty answers should not be the end of the path.</p><div className="mx-auto mt-8 max-w-2xl text-ink"><SearchField value={query} onChange={setQuery} placeholder="Search claiming, branches, pickup, payments, account access…" className="h-14 bg-[var(--surface)]" /></div></div></section><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet">Help resources</p><h2 className="mt-2 text-2xl font-semibold">{query ? `Results for “${query}”` : "Start with the right guide"}</h2></div><span className="text-sm text-secondary">{filtered.length} resource{filtered.length === 1 ? "" : "s"}</span></div>{filtered.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{filtered.map((item) => <Card key={item.id} className="group p-5 transition hover:-translate-y-0.5 hover:shadow-elevated"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet">{item.type === "video" ? <PlayCircle className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span><span className="rounded-full bg-grouped px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-tertiary">{item.category}</span></div><h3 className="mt-5 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{item.description}</p>{item.youtubeId ? <a href={`https://www.youtube.com/watch?v=${item.youtubeId}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet">Watch video<ExternalLink className="h-4 w-4" /></a> : item.type === "video" ? <button onClick={() => setChatOpen(true)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet">Ask for this guide<ArrowRight className="h-4 w-4" /></button> : <button onClick={() => setChatOpen(true)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet">Ask a follow-up<ArrowRight className="h-4 w-4" /></button>}</Card>)}</div> : <Card className="mt-5 p-8 text-center"><Search className="mx-auto h-8 w-8 text-tertiary" /><h3 className="mt-4 text-lg font-bold">No guide matches that search yet.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Start a support conversation. Tell us what you were trying to do and what happened.</p><Button onClick={() => setChatOpen(true)} className="mt-5">Ask Spotly Support</Button></Card>}</section><aside className="space-y-4"><Card className="p-5"><Headphones className="h-5 w-5 text-violet" /><h3 className="mt-4 font-bold">Message support</h3><p className="mt-2 text-sm leading-6 text-secondary">Available to visitors, customers, and businesses. Reply timing follows the support hours shown below.</p><Button onClick={() => setChatOpen(true)} className="mt-5 w-full">Start a conversation</Button></Card>{(settings.support?.hours || settings.support?.email || settings.support?.whatsapp) && <Card className="p-5"><Clock3 className="h-5 w-5 text-violet" /><h3 className="mt-4 font-bold">Contact details</h3>{settings.support?.hours && <p className="mt-2 text-sm leading-6 text-secondary">{settings.support.hours}</p>}<div className="mt-4 space-y-2 text-sm">{settings.support?.email && <a href={`mailto:${settings.support.email}`} className="flex justify-between gap-3"><span className="text-secondary">Email</span><span className="text-right font-semibold text-violet">{settings.support.email}</span></a>}{settings.support?.whatsapp && <a href={`https://wa.me/${String(settings.support.whatsapp).replace(/\D/g, "")}`} className="flex justify-between gap-3"><span className="text-secondary">WhatsApp</span><span className="text-right font-semibold text-violet">{settings.support.whatsapp}</span></a>}</div></Card>}<Card className="p-5"><ShieldCheck className="h-5 w-5 text-success" /><h3 className="mt-4 font-bold">Sensitive information</h3><p className="mt-2 text-sm leading-6 text-secondary">Do not send passwords, one-time codes, PINs, or complete payment credentials in support chat.</p></Card></aside></div></div>{chatOpen && <ChatPanel context={supportContext} onClose={() => setChatOpen(false)} />}</main>;
}
