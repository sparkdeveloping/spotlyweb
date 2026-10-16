"use client";

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
import { Button, EntityPicker, Overlay, SearchField, StatusBadge } from "@/components/ui";
import { CustomerShell } from "@/components/customer-shell";
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
  { id: "customer-orders", title: "Track an order or delivery", description: "Use Activity to follow preparation, Driver progress, delivery PINs, payment and handover status.", category: "Orders & delivery", type: "guide", language: "en", audience: ["public", "customer"] },
  { id: "customer-bookings", title: "Manage a booking, appointment or ticket", description: "Find upcoming plans in Activity, open the reference, review the schedule and contact support with the transaction already attached.", category: "Bookings & tickets", type: "guide", language: "en", audience: ["public", "customer"] },
  { id: "customer-payments", title: "Payment did not complete", description: "Return to Activity and continue payment from the same transaction instead of creating a second order.", category: "Payments", type: "guide", language: "en", audience: ["public", "customer"] },
  { id: "customer-saved", title: "Using Saved", description: "Keep businesses, products, services, events and useful places together for quicker repeat actions.", category: "Customer account", type: "guide", language: "en", audience: ["public", "customer"] },
  { id: "customer-account", title: "Profile, saved places and notifications", description: "Manage contact details, saved places, notification preferences, sign-in methods and privacy requests from Account.", category: "Customer account", type: "guide", language: "en", audience: ["public", "customer"] },
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
  }, [user]);
  useEffect(() => {
    if (!conversationId) return undefined;
    return subscribeSupportMessages(conversationId, setMessages, (error) => toast(error.message, { type: "error", title: "Conversation unavailable" }));
  }, [conversationId, toast]);
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
    <div className="flex h-full min-h-0 flex-col">{conversationId ? <><div className="flex flex-wrap items-center gap-2 border-b p-4"><div className="min-w-0 flex-1"><p className="font-semibold">Reference {conversationId.slice(0, 8).toUpperCase()}</p><div className="mt-1 flex items-center gap-2"><StatusBadge status={conversation?.status || "open"} /><span className="text-xs text-secondary">{conversation?.assignedTo ? "Assigned" : "Waiting for assignment"}</span></div></div><Button size="sm" variant="outline" onClick={toggleClosed} loading={loading}>{conversation?.status === "closed" ? "Reopen" : "Close"}</Button></div><div className="min-h-0 flex-1 overflow-y-auto bg-grouped p-4"><div className="mb-4 rounded-[12px] border bg-[var(--surface)] p-3 text-xs leading-5 text-secondary">We will reply here. Do not send passwords, one-time codes, PINs or complete payment credentials.</div><div className="space-y-3">{messages.filter((message) => !message.internal).map((message) => { const mine = message.senderId === user?.uid || (!message.senderId && message.senderRole === "public"); return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-[16px] px-4 py-3 ${mine ? "bg-[var(--accent)] text-[var(--on-accent)]" : "border bg-[var(--surface)]"}`}><p className={`text-[11px] font-semibold ${mine ? "text-[color-mix(in_srgb,var(--on-accent)_65%,transparent)]" : "text-tertiary"}`}>{message.senderName || (mine ? "You" : "Spotly Support")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>{message.attachments?.length > 0 && <div className="mt-2 space-y-1">{message.attachments.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className={`block text-xs font-semibold underline ${mine ? "text-[var(--on-accent)]" : "text-[var(--accent)]"}`}>{item.name}</a>)}</div>}</div></div>; })}{!messages.length && <p className="py-10 text-center text-sm text-secondary">Loading conversation…</p>}</div><div ref={endRef} /></div>{conversation?.status === "closed" ? <div className="space-y-3 border-t p-4"><p className="text-sm font-semibold">Was this resolved?</p><div className="flex gap-2">{["Yes", "Partly", "No"].map((value) => <Button key={value} size="sm" variant={rating === value ? "secondary" : "outline"} onClick={async () => { setRating(value); try { await rateSupportConversation(conversationId, value.toLowerCase(), user); } catch (error) { toast(error.message || "Feedback could not be saved.", { type: "error" }); } }}>{value}</Button>)}</div><Button variant="ghost" size="sm" onClick={startNew}>Start another conversation</Button></div> : <form onSubmit={send} className="space-y-2 border-t bg-[var(--surface)] p-3"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type your message…" rows={2} className="min-h-12 max-h-28 w-full resize-y rounded-[12px] bg-grouped px-3 py-3 text-sm outline-none" /><div className="flex items-center gap-2"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold"><Paperclip className="h-4 w-4" />{attachment ? attachment.name : "Attach"}<input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf,text/plain" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>{attachmentProgress > 0 && attachmentProgress < 100 && <span className="text-xs text-secondary">{attachmentProgress}%</span>}<span className="flex-1" /><Button type="submit" size="sm" loading={loading}><Send className="h-4 w-4" />Send</Button></div></form>}</> : <form onSubmit={start} className="space-y-4 overflow-y-auto p-5"><div className="rounded-[12px] bg-[var(--accent-soft)] p-4"><p className="text-sm font-semibold text-[var(--accent-strong)]">Start with useful context</p><p className="mt-1 text-xs leading-5 text-secondary">Include the business, order, claim, payment, job or task reference when available.</p></div>{context.reference && <div className="rounded-[12px] border p-3 text-sm"><span className="text-secondary">Linked reference</span><p className="mt-1 font-semibold">{context.reference}</p></div>}{!user && <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold">Name</span><input required className="field-control h-11 w-full text-sm" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-1.5 block text-xs font-semibold">Email</span><input required type="email" className="field-control h-11 w-full text-sm" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>}<div><span className="mb-1.5 block text-xs font-semibold">What do you need help with?</span><EntityPicker value={form.category} onChange={(category) => setForm({ ...form, category })} options={[{ value: "general", label: "General question" }, { value: "business_claim", label: "Business claim" }, { value: "onboarding", label: "Business onboarding" }, { value: "account", label: "Account access" }, { value: "orders", label: "Orders, pickup and delivery" }, { value: "payments", label: "Payments and finance" }, { value: "driver-job", label: "Driver application or delivery" }, { value: "staff-task", label: "Staff task" }, { value: "safety", label: "Safety or urgent concern" }]} title="Choose a help topic" searchPlaceholder="Search help topics" allowClear={false} /></div><label className="block"><span className="mb-1.5 block text-xs font-semibold">Subject</span><input required className="field-control h-11 w-full text-sm" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A short summary" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Message</span><textarea required className="field-control min-h-28 w-full text-sm" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="What were you trying to do, and what happened?" /></label><Button type="submit" loading={loading} className="w-full">Start conversation<ArrowRight className="h-4 w-4" /></Button></form>}</div>
  </Overlay>;
}


export function SupportApp() {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic") || searchParams.get("subject") || (searchParams.get("order") ? "orders" : searchParams.get("payment") ? "payments" : searchParams.get("claim") ? "business_claim" : searchParams.get("job") ? "driver-job" : searchParams.get("task") ? "staff-task" : "");
  const supportContext = { topic: requestedTopic, subject: searchParams.get("subject") || "", reference: searchParams.get("reference") || searchParams.get("order") || searchParams.get("claim") || searchParams.get("payment") || searchParams.get("job") || searchParams.get("task") || "", businessId: searchParams.get("business") || "", orderId: searchParams.get("order") || "", claimId: searchParams.get("claim") || "", paymentId: searchParams.get("payment") || "", jobId: searchParams.get("job") || "", taskId: searchParams.get("task") || "" };
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState(defaultResources);
  const [chatOpen, setChatOpen] = useState(Boolean(requestedTopic));
  const language = "en";
  const { settings } = usePlatform();
  const { user, profile } = useAuth();

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

  return <CustomerShell current="profile" user={user} profile={profile} locationLabel={profile?.preferences?.preferredCity || "Harare"}>
    <div className="v7-page-enter mx-auto max-w-6xl">
      <section className="border-b border-[var(--border-subtle)] pb-8 pt-2">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl"><span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent)]"><HelpCircle className="h-6 w-6" /></span><h1 className="mt-5 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">What are you trying to get done?</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-2)]">Find practical guidance or start a conversation with the right transaction context already attached. A dead end should never be the support experience.</p></div>
          <Button onClick={() => setChatOpen(true)}><MessageCircle className="h-4 w-4" />Contact support</Button>
        </div>
        <div className="mt-6 max-w-3xl"><SearchField value={query} onChange={setQuery} placeholder="Search orders, bookings, payments, account, claiming…" className="h-14 bg-[var(--surface)]" /></div>
      </section>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--accent)]">Help resources</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.03em]">{query ? `Results for “${query}”` : "Start with the right guide"}</h2></div><span className="text-sm text-[var(--text-3)]">{filtered.length} resource{filtered.length === 1 ? "" : "s"}</span></div>
          {filtered.length ? <div className="mt-5 divide-y divide-[var(--border-subtle)]">{filtered.map((item) => <article key={item.id} className="group flex gap-4 py-5 first:pt-0"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent)]">{item.type === "video" ? <PlayCircle className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-3)]">{item.category}</span></div><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{item.description}</p>{item.youtubeId ? <a href={`https://www.youtube.com/watch?v=${item.youtubeId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">Watch video<ExternalLink className="h-4 w-4" /></a> : <button onClick={() => setChatOpen(true)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">{item.type === "video" ? "Ask for this guide" : "Ask a follow-up"}<ArrowRight className="h-4 w-4" /></button>}</div></article>)}</div> : <div className="mt-6 rounded-[var(--radius-feature)] border border-dashed border-[var(--border)] px-6 py-12 text-center"><Search className="mx-auto h-8 w-8 text-[var(--text-3)]" /><h3 className="mt-4 text-lg font-semibold">No guide matches that search yet.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-2)]">Tell support what you were trying to do. Your conversation becomes the next useful path instead of a blank result.</p><Button onClick={() => setChatOpen(true)} className="mt-5">Ask Spotly Support</Button></div>}
        </section>

        <aside className="space-y-6 border-t border-[var(--border-subtle)] pt-7 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div><Headphones className="h-5 w-5 text-[var(--accent)]" /><h3 className="mt-3 font-semibold">Message support</h3><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Available to visitors, customers, Drivers and businesses. Include the relevant order, booking, ride, Send or business reference when you have it.</p><Button onClick={() => setChatOpen(true)} className="mt-4 w-full">Start a conversation</Button></div>
          {(settings.support?.hours || settings.support?.email || settings.support?.whatsapp) ? <div className="border-t border-[var(--border-subtle)] pt-6"><Clock3 className="h-5 w-5 text-[var(--accent)]" /><h3 className="mt-3 font-semibold">Contact details</h3>{settings.support?.hours ? <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{settings.support.hours}</p> : null}<div className="mt-4 space-y-3 text-sm">{settings.support?.email ? <a href={`mailto:${settings.support.email}`} className="flex justify-between gap-3"><span className="text-[var(--text-3)]">Email</span><span className="text-right font-semibold text-[var(--accent)]">{settings.support.email}</span></a> : null}{settings.support?.whatsapp ? <a href={`https://wa.me/${String(settings.support.whatsapp).replace(/\D/g, "")}`} className="flex justify-between gap-3"><span className="text-[var(--text-3)]">WhatsApp</span><span className="text-right font-semibold text-[var(--accent)]">{settings.support.whatsapp}</span></a> : null}</div></div> : null}
          <div className="border-t border-[var(--border-subtle)] pt-6"><ShieldCheck className="h-5 w-5 text-[var(--success)]" /><h3 className="mt-3 font-semibold">Keep private information private</h3><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Never send passwords, one-time codes, PINs or complete payment credentials in support chat.</p></div>
        </aside>
      </div>
    </div>
    {chatOpen ? <ChatPanel context={supportContext} onClose={() => setChatOpen(false)} /> : null}
  </CustomerShell>;
}
