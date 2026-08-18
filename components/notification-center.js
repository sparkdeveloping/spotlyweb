"use client";

import Link from "next/link";
import { Bell, CheckCheck, Inbox, MailCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/firebase-provider";
import { Badge, Button, Card, EmptyState, Overlay, PageHeader, Tabs } from "@/components/ui";
import { markNotificationRead, subscribeNotifications } from "@/lib/firebase-services";

export function notificationWorkspace(item = {}) {
  if (item.workspace) return item.workspace;
  const category = String(item.category || item.eventType || "").toLowerCase();
  if (category.includes("driver")) return "driver";
  if (category.includes("business") || category.includes("claim") || category.includes("launch") || category.includes("location_review")) return "business";
  if (category.includes("staff") || category.includes("people") || category.includes("leave")) return "staff";
  if (category.includes("admin") || category.includes("review_queue")) return "admin";
  return "customer";
}

export function isReviewNotification(item = {}) {
  const text = `${item.category || ""} ${item.eventType || ""} ${item.module || ""}`.toLowerCase();
  return text.includes("review") || text.includes("claim") || text.includes("approval") || text.includes("verification");
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeLabel(value) {
  const date = toDate(value);
  if (!date) return "Recently";
  return new Intl.DateTimeFormat("en-ZW", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function NotificationRow({ item, onRead }) {
  const content = <>
    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? "bg-[var(--border)]" : "bg-[var(--accent)]"}`} />
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title || "Spotly update"}</span>{isReviewNotification(item) && <Badge tone="warning">Review</Badge>}{["high", "critical"].includes(item.importance) && <Badge tone={item.importance === "critical" ? "danger" : "neutral"}>{item.importance}</Badge>}</span>
      <span className="mt-1 block text-sm leading-6 text-secondary">{item.body || "Open Spotly for the latest activity."}</span>
      <span className="mt-2 block text-xs text-tertiary">{timeLabel(item.createdAt)} · {notificationWorkspace(item)}</span>
    </span>
  </>;
  if (item.href) return <Link href={item.href} onClick={() => onRead(item)} className="flex items-start gap-3 rounded-xl border p-4 transition hover:bg-[var(--surface-2)]">{content}</Link>;
  return <button type="button" onClick={() => onRead(item)} className="flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:bg-[var(--surface-2)]">{content}</button>;
}

export function NotificationCenter({ workspace = "", businessId = null, title = "Notifications", description = "Activity, reviews and important updates for this workspace." }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeNotifications(user.uid, (records) => { setItems(records); setError(""); }, (reason) => setError(reason?.message || "Notifications could not be loaded."));
  }, [user?.uid]);
  const scoped = useMemo(() => items.filter((item) => {
    if (workspace && notificationWorkspace(item) !== workspace) return false;
    if (businessId && item.businessId && item.businessId !== businessId) return false;
    return true;
  }), [businessId, items, workspace]);
  const visible = scoped.filter((item) => filter === "unread" ? !item.read : filter === "reviews" ? isReviewNotification(item) : true);
  const unread = scoped.filter((item) => !item.read).length;
  async function read(item) {
    if (item.read) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
    try { await markNotificationRead(item.id); } catch {}
  }
  async function readAll() {
    const unreadItems = scoped.filter((item) => !item.read);
    setItems((current) => current.map((item) => scoped.some((entry) => entry.id === item.id) ? { ...item, read: true } : item));
    await Promise.allSettled(unreadItems.map((item) => markNotificationRead(item.id)));
  }
  return <div className="space-y-6">
    <PageHeader title={title} description={description} actions={unread ? <Button variant="outline" onClick={readAll}><CheckCheck className="h-4 w-4" />Mark all read</Button> : null} />
    <Card className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Tabs value={filter} onChange={setFilter} tabs={[{ value: "all", label: `All (${scoped.length})` }, { value: "unread", label: `Unread (${unread})` }, { value: "reviews", label: `Reviews (${scoped.filter(isReviewNotification).length})` }]} /><p className="text-xs text-tertiary"><MailCheck className="mr-1 inline h-4 w-4" />Review decisions also use configured operational email.</p></div></Card>
    {error ? <Card className="border-danger/30 bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</Card> : visible.length ? <div className="space-y-3">{visible.map((item) => <NotificationRow key={item.id} item={item} onRead={read} />)}</div> : <EmptyState icon={filter === "reviews" ? MailCheck : Inbox} title={filter === "reviews" ? "No review updates here" : "You're caught up"} description="New activity for this workspace will appear here." />}
  </div>;
}

export function NotificationBell({ className = "", workspace = "" }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((item) => !item.read).length;
  const relevant = workspace ? items.filter((item) => notificationWorkspace(item) === workspace) : items;
  const trayItems = relevant.slice(0, 8);
  useEffect(() => user?.uid ? subscribeNotifications(user.uid, setItems, () => setItems([])) : undefined, [user?.uid]);
  async function read(item) {
    if (!item.read) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      try { await markNotificationRead(item.id); } catch {}
    }
    setOpen(false);
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`${unread} notifications`} className={`relative flex h-11 w-11 items-center justify-center rounded-xl border bg-[var(--surface)] hover:bg-[var(--surface-2)] ${className}`}><Bell className="h-5 w-5" />{unread ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-[var(--surface)]" /> : null}</button>
    <Overlay open={open} onClose={() => setOpen(false)} title="Notifications" description={workspace ? `Latest activity for ${workspace} and your Spotly account.` : "Latest activity across your Spotly account and workspaces."} mode="sheet">
      <div className="space-y-3 p-4">
        {trayItems.length ? trayItems.map((item) => <NotificationRow key={item.id} item={item} onRead={read} />) : <EmptyState icon={Inbox} title="You're caught up" description="New Spotly activity will appear here." />}
        <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}><Link href="/account#notifications">Open all notifications</Link></Button>
      </div>
    </Overlay>
  </>;
}
