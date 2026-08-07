"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Clock3, ExternalLink, LifeBuoy, MessageCircle, Plus, Send, Video } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, FieldLabel, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";
import { createSupportConversation, sendSupportMessage, subscribeHelpResources, subscribeSupportMessages, updateSupportConversation } from "@/lib/firebase-services";

function NewConversationModal({ open, onClose, onCreated }) {
  const { business, user } = useBusinessWorkspace();
  const [form, setForm] = useState({ subject: "", category: "business_setup", priority: "normal", message: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (open) setForm({ subject: "", category: "business_setup", priority: "normal", message: "" }); }, [open]);
  async function submit(event) {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return toast("Add a subject and explain what you need help with.", { type: "error", title: "More detail needed" });
    setSaving(true);
    try {
      const id = await createSupportConversation({ ...form, audience: "business", businessId: business.id }, user);
      toast("Your conversation is open. Spotly Support can now respond in the same thread.", { title: "Support request sent" });
      onCreated(id); onClose();
    } catch (error) { toast(error.message || "The support request could not be sent.", { type: "error", title: "Could not open conversation" }); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Start a support conversation"><form onSubmit={submit} className="space-y-5 p-5"><FieldLabel label="Subject" required><input className={fieldClass} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="What do you need help with?" /></FieldLabel><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Area"><select className={selectClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="business_setup">Business setup</option><option value="verification">Verification</option><option value="catalog">Catalog and products</option><option value="orders">Orders and pickup</option><option value="payments">Payments and payouts</option><option value="access">Staff access</option><option value="technical">Technical problem</option><option value="other">Other</option></select></FieldLabel><FieldLabel label="Priority"><select className={selectClass} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">Normal</option><option value="high">High — blocking operations</option><option value="urgent">Urgent — active customer impact</option></select></FieldLabel></div><FieldLabel label="Message" required hint="Include the screen, order, branch, or action involved so the team can help faster."><textarea className={textAreaClass} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Describe what happened and what you expected." /></FieldLabel><div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Send to support</Button></div></form></Modal>;
}

function Conversation({ conversation, onCloseConversation }) {
  const { user } = useBusinessWorkspace();
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const { toast } = useToast();
  useEffect(() => subscribeSupportMessages(conversation?.id, setMessages, () => {}), [conversation?.id]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);
  async function send(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try { await sendSupportMessage(conversation.id, body.trim(), user, { senderRole: "business", status: conversation.status === "closed" ? "reopened" : "open" }); setBody(""); }
    catch (error) { toast(error.message || "Your message could not be sent.", { type: "error", title: "Message not sent" }); }
    finally { setSending(false); }
  }
  async function closeThread() {
    try { await updateSupportConversation(conversation.id, { status: "closed", closedAt: new Date().toISOString() }, user); toast("The conversation has been closed."); onCloseConversation?.(); }
    catch (error) { toast(error.message || "The conversation could not be closed.", { type: "error" }); }
  }
  return <Card className="flex min-h-[610px] flex-col overflow-hidden"><div className="flex items-start gap-4 border-b p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-business-soft text-business"><MessageCircle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{conversation.subject}</h2><StatusBadge status={conversation.status || "open"} /></div><p className="mt-1 text-xs text-secondary">{conversation.category?.replaceAll("_", " ")} · {conversation.priority || "normal"} priority</p></div>{conversation.status !== "closed" && <Button size="sm" variant="outline" onClick={closeThread}>Close</Button>}</div><div className="flex-1 space-y-4 overflow-y-auto bg-grouped/45 p-5">{messages.filter((item) => !item.internal).map((message) => { const mine = message.senderId === user.uid || message.senderRole === "business"; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 ${mine ? "bg-business text-white" : "bg-white shadow-sm"}`}><p className={`text-xs font-semibold ${mine ? "text-white/75" : "text-secondary"}`}>{mine ? "You" : message.senderName || "Spotly Support"}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className={`mt-2 text-[11px] ${mine ? "text-white/70" : "text-tertiary"}`}>{message.createdAt?.toDate?.().toLocaleString() || "Just now"}</p></div></div>; })}{!messages.length && <div className="flex min-h-72 items-center justify-center text-center"><div><Clock3 className="mx-auto h-7 w-7 text-tertiary" /><p className="mt-3 text-sm font-semibold">Loading conversation</p></div></div>}<div ref={endRef} /></div><form onSubmit={send} className="flex gap-3 border-t p-4"><textarea value={body} onChange={(event) => setBody(event.target.value)} className="surface min-h-12 flex-1 resize-none rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-business/20" placeholder={conversation.status === "closed" ? "Reply to reopen this conversation" : "Write a message to Spotly Support"} /><Button type="submit" size="icon" loading={sending} aria-label="Send message"><Send className="h-4 w-4" /></Button></form></Card>;
}

export function SupportView() {
  const { support } = useBusinessWorkspace();
  const [resources, setResources] = useState([]);
  const [queryText, setQueryText] = useState("");
  const [tab, setTab] = useState("conversations");
  const [selectedId, setSelectedId] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => subscribeHelpResources(setResources, { audience: "business", limit: 100, onError: () => {} }), []);
  useEffect(() => { if (!selectedId && support.length) setSelectedId(support[0].id); }, [support, selectedId]);
  const selected = support.find((item) => item.id === selectedId) || support[0];
  const visibleSupport = useMemo(() => support.filter((item) => [item.subject, item.category, item.status, item.lastMessage].join(" ").toLowerCase().includes(queryText.toLowerCase())), [support, queryText]);
  const visibleResources = useMemo(() => resources.filter((item) => [item.title, item.description, item.category, item.locale].join(" ").toLowerCase().includes(queryText.toLowerCase())), [resources, queryText]);
  return <div className="space-y-6"><PageHeader title="Help & support" description="Use guided resources for common tasks or keep a message thread with the Spotly team." actions={<><BusinessSwitcher /><Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />Start conversation</Button></>} /><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><SearchField value={queryText} onChange={setQueryText} placeholder="Search conversations or help resources" /><Tabs value={tab} onChange={setTab} tabs={[{ value: "conversations", label: `Conversations (${support.length})` }, { value: "resources", label: `Help resources (${resources.length})` }]} /></div>{tab === "conversations" ? <div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Card className="overflow-hidden"><div className="border-b p-4"><h2 className="font-bold">Your conversations</h2><p className="mt-1 text-xs text-secondary">Select a conversation to continue.</p></div>{visibleSupport.length ? <div className="max-h-[610px] overflow-y-auto">{visibleSupport.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full border-b p-4 text-left transition last:border-0 ${selected?.id === item.id ? "bg-business-soft" : "hover:bg-grouped"}`}><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.subject}</p><StatusBadge status={item.status || "open"} /></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{item.lastMessage}</p></button>)}</div> : <EmptyState icon={LifeBuoy} title="No support conversations" description="Open a conversation and the full history will remain here." action={<Button size="sm" onClick={() => setNewOpen(true)}>Ask for help</Button>} />}</Card>{selected ? <Conversation conversation={selected} /> : <SectionCard><EmptyState icon={MessageCircle} title="Select a conversation" description="Choose a thread from the left or start a new one." /></SectionCard>}</div> : <SectionCard title="Business help centre" description="Orientation videos and guides are controlled from Spotly Admin.">{visibleResources.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{visibleResources.map((resource) => <a key={resource.id} href={resource.url || resource.videoUrl || "#"} target="_blank" rel="noreferrer" className="rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-card"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-business-soft text-business">{resource.type === "video" ? <Video className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span><div className="mt-4 flex items-start gap-2"><h3 className="min-w-0 flex-1 font-bold">{resource.title}</h3><ExternalLink className="h-4 w-4 text-tertiary" /></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-secondary">{resource.description || "Open this Spotly guide."}</p><div className="mt-4 flex gap-2"><Badge>{resource.category || "Guide"}</Badge><Badge tone="accent">{resource.locale === "sn" ? "ChiShona" : resource.locale === "nd" ? "isiNdebele" : "English"}</Badge></div></a>)}</div> : <EmptyState icon={BookOpen} title="Help resources are being prepared" description="Message Spotly Support now. Admins can publish orientation videos and guides without a new deployment." action={<Button onClick={() => setNewOpen(true)}><MessageCircle className="h-4 w-4" />Ask Spotly Support</Button>} />}</SectionCard>}<Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-success"><CheckCircle2 className="h-5 w-5" /></span><div><h2 className="font-bold">No request disappears</h2><p className="mt-1 text-sm leading-6 text-secondary">Every conversation, response, assignment, priority, and status stays in one shared history for the business and authorized Spotly support team.</p></div></div></Card><NewConversationModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={setSelectedId} /></div>;
}
