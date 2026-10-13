"use client";

import Link from "next/link";
import {
  Bell,
  CheckCheck,
  CircleDollarSign,
  ClipboardCheck,
  Inbox,
  LifeBuoy,
  MailCheck,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/firebase-provider";
import { Badge, Button, Card, EmptyState, Overlay, PageHeader, Tabs } from "@/components/ui";
import { LottieEmptyState, SpotlyLottie } from "@/components/spotly-lottie";
import { markNotificationRead, subscribeNotifications } from "@/lib/firebase-services";
import { canonicalSpotlyUrl } from "@/lib/spotly-domains";

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

export function notificationModule(item = {}) {
  const text = `${item.module || ""} ${item.category || ""} ${item.eventType || ""}`.toLowerCase();
  if (text.includes("location") || text.includes("branch")) return "locations";
  if (text.includes("payout") || text.includes("money") || text.includes("finance") || text.includes("settlement") || text.includes("payment")) return "money";
  if (text.includes("support") || text.includes("conversation")) return "support";
  if (text.includes("order") || text.includes("delivery") || text.includes("pickup")) return "orders";
  if (isReviewNotification(item)) return "reviews";
  if (text.includes("driver")) return "driver";
  if (text.includes("security") || text.includes("access")) return "access";
  return "general";
}

const moduleMeta = {
  reviews: { label: "Reviews", icon: ClipboardCheck },
  orders: { label: "Orders & delivery", icon: PackageCheck },
  locations: { label: "Locations", icon: MapPin },
  money: { label: "Money", icon: CircleDollarSign },
  support: { label: "Support", icon: LifeBuoy },
  driver: { label: "Driver", icon: Truck },
  access: { label: "Access", icon: ShieldCheck },
  general: { label: "Activity", icon: Bell }
};

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

function NotificationRow({ item, onRead, businessName = "" }) {
  const module = notificationModule(item);
  const meta = moduleMeta[module] || moduleMeta.general;
  const Icon = meta.icon;
  const content = <>
    <motion.span
      initial={{ scale: 0.92, opacity: 0.75 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.read ? "bg-[var(--surface-2)] text-secondary" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}
    >
      <Icon className="h-5 w-5" />
    </motion.span>
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{item.title || "Spotly update"}</span>
        {!item.read && <Badge tone="accent">New</Badge>}
        {isReviewNotification(item) && <Badge tone="warning">Review</Badge>}
        {["high", "critical"].includes(item.importance) && <Badge tone={item.importance === "critical" ? "danger" : "neutral"}>{item.importance}</Badge>}
      </span>
      <span className="mt-1 block text-sm leading-6 text-secondary">{item.body || "Open Spotly for the latest activity."}</span>
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
        <span>{timeLabel(item.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{businessName || meta.label}</span>
        {businessName && <><span aria-hidden="true">·</span><span>{meta.label}</span></>}
      </span>
    </span>
  </>;
  const classes = "flex items-start gap-3 rounded-xl border bg-[var(--surface)] p-4 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] hover:bg-[var(--surface-2)]";
  if (item.href) return <Link href={canonicalSpotlyUrl(item.href, notificationWorkspace(item))} onClick={() => onRead(item)} className={classes}>{content}</Link>;
  return <button type="button" onClick={() => onRead(item)} className={`w-full ${classes}`}>{content}</button>;
}

export function NotificationCenter({
  workspace = "",
  businessId = null,
  businessOptions = [],
  showModuleFilters = false,
  title = "Notifications",
  description = "Activity, reviews and important updates for this workspace."
}) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeNotifications(user.uid, (records) => { setItems(records); setError(""); }, (reason) => setError(reason?.message || "Notifications could not be loaded."));
  }, [user?.uid]);

  const businessMap = useMemo(() => new Map((businessOptions || []).map((item) => [item.id, item.name])), [businessOptions]);
  const scoped = useMemo(() => items.filter((item) => {
    if (workspace && notificationWorkspace(item) !== workspace) return false;
    // A business-specific surface must never inherit old unscoped notifications from another
    // business. Legacy notifications without businessId belong only in the account-wide tray.
    if (businessId && item.businessId !== businessId) return false;
    if (businessFilter !== "all" && item.businessId !== businessFilter) return false;
    return true;
  }), [businessFilter, businessId, items, workspace]);

  const counts = useMemo(() => {
    const result = { all: scoped.length, unread: 0, reviews: 0, orders: 0, locations: 0, money: 0, support: 0 };
    scoped.forEach((item) => {
      if (!item.read) result.unread += 1;
      const module = notificationModule(item);
      if (Object.prototype.hasOwnProperty.call(result, module)) result[module] += 1;
    });
    return result;
  }, [scoped]);

  const visible = scoped.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "reviews") return isReviewNotification(item);
    if (["orders", "locations", "money", "support"].includes(filter)) return notificationModule(item) === filter;
    return true;
  });

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

  const tabs = [
    { value: "all", label: `All (${counts.all})`, icon: Bell },
    { value: "unread", label: `Unread (${counts.unread})`, icon: Inbox },
    ...(showModuleFilters ? [
      { value: "reviews", label: `Reviews (${counts.reviews})`, icon: ClipboardCheck },
      { value: "orders", label: `Orders (${counts.orders})`, icon: PackageCheck },
      { value: "locations", label: `Locations (${counts.locations})`, icon: MapPin },
      { value: "money", label: `Money (${counts.money})`, icon: CircleDollarSign },
      { value: "support", label: `Support (${counts.support})`, icon: LifeBuoy }
    ] : [{ value: "reviews", label: `Reviews (${counts.reviews})`, icon: ClipboardCheck }])
  ];

  return <div className="space-y-6">
    <PageHeader title={title} description={description} actions={counts.unread ? <Button variant="outline" onClick={readAll}><CheckCheck className="h-4 w-4" />Mark all read</Button> : null} />
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        {businessOptions.length > 1 && <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Store className="h-4 w-4 text-[var(--accent)]" />Business</div><select className="field-control h-11 w-full sm:max-w-xs" value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}><option value="all">All businesses</option>{businessOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><Tabs value={filter} onChange={setFilter} tabs={tabs} /><p className="text-xs leading-5 text-tertiary"><MailCheck className="mr-1 inline h-4 w-4" />Review decisions can also use the configured operational email.</p></div>
      </div>
    </Card>
    {error ? <Card className="border-danger/30 bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</Card> : visible.length ? <div className="space-y-3">{visible.map((item) => <NotificationRow key={item.id} item={item} businessName={item.businessName || businessMap.get(item.businessId) || ""} onRead={read} />)}</div> : <LottieEmptyState name={filter === "reviews" ? "verified-business" : "notification-bell"} title={filter === "reviews" ? "No review updates here" : "You're caught up"} description={businessFilter === "all" ? "New activity for this workspace will appear here." : "No notifications match this business and filter."} />}
  </div>;
}

export function NotificationBell({ className = "", workspace = "" }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const relevant = workspace ? items.filter((item) => notificationWorkspace(item) === workspace) : items;
  const unread = relevant.filter((item) => !item.read).length;
  const trayItems = relevant.slice(0, 8);
  useEffect(() => user?.uid ? subscribeNotifications(user.uid, (records) => { setItems(records); setError(""); }, (reason) => setError(reason?.message || "Notifications could not be refreshed.")) : undefined, [user?.uid]);
  async function read(item) {
    if (!item.read) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      try { await markNotificationRead(item.id); } catch {}
    }
    setOpen(false);
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`${unread} notifications`} className={`relative flex h-11 w-11 items-center justify-center overflow-visible rounded-xl border bg-[var(--surface)] hover:bg-[var(--surface-2)] ${className}`}>{unread ? <SpotlyLottie name="notification-bell" mode="state" playKey={unread} className="h-9 w-9" fallback={<Bell className="h-5 w-5" />} /> : <Bell className="h-5 w-5" />}{unread ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-[var(--surface)]" /> : null}</button>
    <Overlay open={open} onClose={() => setOpen(false)} title="Notifications" description={workspace ? `Latest activity for your ${workspace} workspace.` : "Latest activity across your Spotly account and workspaces."} mode="sheet">
      <div className="space-y-3 p-4">
        {error ? <Card className="border-danger/30 bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</Card> : trayItems.length ? trayItems.map((item) => <NotificationRow key={item.id} item={item} onRead={read} />) : <LottieEmptyState name="notification-bell" title="You're caught up" description="New Spotly activity will appear here." />}
        <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}><Link href={workspace === "business" ? "/notifications" : "/account#notifications"}>Open all notifications</Link></Button>
      </div>
    </Overlay>
  </>;
}
