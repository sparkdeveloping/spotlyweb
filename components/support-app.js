"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  ExternalLink,
  Headphones,
  HelpCircle,
  MessageCircle,
  PlayCircle,
  Search,
  Send,
  ShieldCheck,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, SearchField } from "@/components/ui";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import {
  createSupportConversation,
  sendSupportMessage,
  subscribeHelpResources,
  subscribeSupportMessages,
  track
} from "@/lib/firebase-services";

const defaultResources = [
  { id: "claim", title: "How business claiming works", description: "Search, confirm, verify ownership, and continue setup without starting from zero.", category: "Business setup", type: "guide", language: "en", audience: ["public", "business"] },
  { id: "branches", title: "Organizing brands and branches", description: "Understand organizations, business brands, branches, branch managers, and shared settings.", category: "Business setup", type: "guide", language: "en", audience: ["business"] },
  { id: "pickup", title: "Preparing grocery pickup", description: "Configure products, availability, substitution choices, pickup slots, and order handover.", category: "Commerce", type: "guide", language: "en", audience: ["business"] },
  { id: "verification", title: "Documents and verification", description: "What Spotly may request and how to respond when more information is needed.", category: "Trust & safety", type: "guide", language: "en", audience: ["business"] },
  { id: "video-orientation", title: "Spotly Business orientation", description: "The orientation video will be embedded here when its unlisted YouTube link is added by an administrator.", category: "Getting started", type: "video", language: "en", audience: ["business"], youtubeId: "" },
  { id: "support", title: "Getting useful support", description: "Open a conversation, include context, and follow status updates without losing the history.", category: "Support", type: "guide", language: "en", audience: ["public", "business"] }
];

function ChatPanel({ onClose }) {
  const { user, ensureAnonymousSession } = useAuth();
  const { settings } = usePlatform();
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({ name: user?.displayName || "", email: user?.email || "", subject: "", category: "general", message: "" });
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("spotly-support-conversation");
    if (saved) setConversationId(saved);
  }, []);
  useEffect(() => {
    if (!conversationId) return undefined;
    return subscribeSupportMessages(conversationId, setMessages, () => {});
  }, [conversationId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function start(event) {
    event.preventDefault(); setLoading(true);
    try {
      const sessionUser = user || await ensureAnonymousSession();
      const id = await createSupportConversation({ ...form, audience: sessionUser.isAnonymous ? "public" : "customer" }, sessionUser);
      window.localStorage.setItem("spotly-support-conversation", id);
      setConversationId(id);
      setForm((current) => ({ ...current, message: "" }));
    } catch (error) { toast(error.message, { type: "error", title: "Could not start chat" }); } finally { setLoading(false); }
  }
  async function send(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    const body = reply.trim(); setReply("");
    try { await sendSupportMessage(conversationId, body, user, { senderName: form.name || "Visitor", senderRole: user ? "customer" : "public" }); } catch (error) { setReply(body); toast(error.message, { type: "error", title: "Message not sent" }); }
  }

  return <motion.aside initial={{ opacity: 0, x: 20, y: 20 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: 20, y: 20 }} className="fixed inset-x-3 bottom-3 z-[70] flex max-h-[82vh] flex-col overflow-hidden rounded-[24px] border bg-white shadow-[0_24px_80px_rgba(17,24,39,.22)] sm:left-auto sm:right-5 sm:w-[410px]"><div className="flex items-center gap-3 bg-gradient-to-r from-violet-strong to-violet p-4 text-white"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Headphones className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">Spotly Support</p><p className="mt-0.5 text-xs text-white/65">{settings.support?.hours || "Support details are being configured"}</p></div><button aria-label="Close chat" onClick={onClose} className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5" /></button></div>{conversationId ? <><div className="min-h-0 flex-1 overflow-y-auto bg-grouped p-4"><div className="mb-4 rounded-xl border bg-white p-3 text-xs leading-5 text-secondary">Conversation <strong>{conversationId.slice(0, 8).toUpperCase()}</strong> is saved on this browser. A support agent can assign, escalate, and respond from Spotly Admin.</div><div className="space-y-3">{messages.length ? messages.filter((message) => !message.internal).map((message) => { const mine = message.senderId === user?.uid || (!message.senderId && message.senderRole === "public"); return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-violet text-white" : "border bg-white"}`}><p className={`text-[11px] font-bold ${mine ? "text-white/65" : "text-tertiary"}`}>{message.senderName || (mine ? "You" : "Spotly Support")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p></div></div>; }) : <div className="py-10 text-center"><MessageCircle className="mx-auto h-8 w-8 text-tertiary" /><p className="mt-3 text-sm text-secondary">Your conversation is loading.</p></div>}</div><div ref={endRef} /></div><form onSubmit={send} className="flex items-end gap-2 border-t bg-white p-3"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type your message…" rows={1} className="min-h-11 max-h-28 flex-1 resize-y rounded-xl bg-grouped px-3 py-3 text-sm outline-none" /><Button type="submit" size="icon" aria-label="Send message"><Send className="h-4 w-4" /></Button></form></> : <form onSubmit={start} className="space-y-4 overflow-y-auto p-4"><div className="rounded-2xl bg-violet-soft p-4"><p className="text-sm font-semibold text-violet-strong">Start with useful context</p><p className="mt-1 text-xs leading-5 text-secondary">Your message creates a real support conversation with status, assignment, and history.</p></div>{!user && <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold">Name</span><input required className="surface h-11 w-full rounded-xl px-3 text-sm outline-none" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-1.5 block text-xs font-semibold">Email</span><input required type="email" className="surface h-11 w-full rounded-xl px-3 text-sm outline-none" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>}<label className="block"><span className="mb-1.5 block text-xs font-semibold">What do you need help with?</span><select className="surface h-11 w-full rounded-xl px-3 text-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="general">General question</option><option value="business_claim">Business claim</option><option value="onboarding">Business onboarding</option><option value="account">Account access</option><option value="orders">Orders and pickup</option><option value="payments">Payments and finance</option><option value="partnership">Partnership</option><option value="safety">Safety or urgent concern</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Subject</span><input required className="surface h-11 w-full rounded-xl px-3 text-sm outline-none" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A short summary" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Message</span><textarea required className="surface min-h-28 w-full rounded-xl p-3 text-sm outline-none" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Include the business, branch, reference, or result you were expecting." /></label><Button type="submit" loading={loading} className="w-full">Start conversation<ArrowRight className="h-4 w-4" /></Button></form>}</motion.aside>;
}

export function SupportApp() {
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState(defaultResources);
  const [chatOpen, setChatOpen] = useState(false);
  const [language, setLanguage] = useState("en");
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

  return <main className="min-h-screen bg-grouped text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><header className="border-b bg-white"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={42} height={42} className="rounded-[14px]" /><span className="font-black">Spotly Support</span></Link><div className="flex items-center gap-2"><select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold"><option value="en">English</option><option value="sn">ChiShona</option><option value="nd">isiNdebele</option></select><Button onClick={() => setChatOpen(true)}><MessageCircle className="h-4 w-4" />Live chat</Button></div></div></header><section className="bg-gradient-to-br from-[#171329] via-violet-strong to-violet px-4 py-16 text-white sm:px-6 lg:py-24"><div className="mx-auto max-w-4xl text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12"><HelpCircle className="h-7 w-7" /></span><h1 className="mt-6 text-4xl font-black tracking-[-.045em] sm:text-5xl">What are you trying to get done?</h1><p className="mx-auto mt-4 max-w-2xl leading-7 text-white/70">Search practical guidance or start a support conversation. Empty answers should not be the end of the path.</p><div className="mx-auto mt-8 max-w-2xl text-ink"><SearchField value={query} onChange={setQuery} placeholder="Search claiming, branches, pickup, payments, account access…" className="h-14 bg-white shadow-elevated" /></div></div></section><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet">Help resources</p><h2 className="mt-2 text-2xl font-black">{query ? `Results for “${query}”` : "Start with the right guide"}</h2></div><span className="text-sm text-secondary">{filtered.length} resource{filtered.length === 1 ? "" : "s"}</span></div>{filtered.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{filtered.map((item) => <Card key={item.id} className="group p-5 transition hover:-translate-y-0.5 hover:shadow-elevated"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet">{item.type === "video" ? <PlayCircle className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span><span className="rounded-full bg-grouped px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-tertiary">{item.category}</span></div><h3 className="mt-5 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{item.description}</p>{item.youtubeId ? <a href={`https://www.youtube.com/watch?v=${item.youtubeId}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet">Watch video<ExternalLink className="h-4 w-4" /></a> : item.type === "video" ? <p className="mt-5 text-xs font-semibold text-amber-700">Video coming soon</p> : <button onClick={() => setChatOpen(true)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet">Ask a follow-up<ArrowRight className="h-4 w-4" /></button>}</Card>)}</div> : <Card className="mt-5 p-8 text-center"><Search className="mx-auto h-8 w-8 text-tertiary" /><h3 className="mt-4 text-lg font-bold">No guide matches that search yet.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Start a support conversation. Your question can also show administrators where a new help resource is needed.</p><Button onClick={() => setChatOpen(true)} className="mt-5">Ask Spotly Support</Button></Card>}</section><aside className="space-y-4"><Card className="p-5"><Headphones className="h-5 w-5 text-violet" /><h3 className="mt-4 font-bold">Live support</h3><p className="mt-2 text-sm leading-6 text-secondary">Available to visitors, customers, and businesses. Conversations keep their status and history.</p><Button onClick={() => setChatOpen(true)} className="mt-5 w-full">Start a conversation</Button></Card><Card className="p-5"><Clock3 className="h-5 w-5 text-violet" /><h3 className="mt-4 font-bold">Support hours</h3><p className="mt-2 text-sm leading-6 text-secondary">{settings.support?.hours || "Administration has not published support hours yet."}</p><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><span className="text-secondary">Email</span><span className="text-right font-semibold">{settings.support?.email || "To be configured"}</span></div><div className="flex justify-between gap-3"><span className="text-secondary">WhatsApp</span><span className="text-right font-semibold">{settings.support?.whatsapp || "To be configured"}</span></div></div></Card><Card className="p-5"><ShieldCheck className="h-5 w-5 text-success" /><h3 className="mt-4 font-bold">Sensitive information</h3><p className="mt-2 text-sm leading-6 text-secondary">Do not send passwords, one-time codes, PINs, or complete payment credentials in support chat.</p></Card></aside></div></div><AnimatePresence>{chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}</AnimatePresence></main>;
}
