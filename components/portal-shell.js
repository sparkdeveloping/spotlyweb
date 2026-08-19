"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bell,
  Bike,
  Check,
  ClipboardCheck,
  ChevronDown,
  Command,
  Laptop,
  LogOut,
  Menu,
  MoreHorizontal,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PackageCheck,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Sun,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { portals } from "@/data/portals";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { useTheme } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import { Badge, Overlay } from "@/components/ui";
import { markNotificationRead, subscribeNotifications } from "@/lib/firebase-services";
import { adminSectionsForProfile } from "@/lib/admin-access";
import { workspaceAccess, WORKSPACE_SETTINGS_ROUTES } from "@/lib/workspaces";
import { isLegacyPortalPath, resolvePortalNavigation, resolveSpotlyHref, spotlyPortalUrl } from "@/lib/spotly-domains";
import { isReviewNotification, notificationWorkspace } from "@/components/notification-center";


function useOutsideClick(ref, callback) {
  useEffect(() => {
    function handler(event) {
      if (ref.current && !ref.current.contains(event.target)) callback();
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [callback, ref]);
}

function accessiblePortals(profile, memberships, staffProfile, driverProfile, driverApplication) {
  const access = workspaceAccess({ profile, memberships, staffProfile, driverProfile: driverProfile || driverApplication });
  return [...access].map((id) => portals[id]).filter(Boolean);
}

function PortalSwitcher({ portal, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { profile, memberships, staffProfile, driverProfile, driverApplication } = useAuth();
  const available = useMemo(() => accessiblePortals(profile, memberships, staffProfile, driverProfile, driverApplication), [profile, memberships, staffProfile, driverProfile, driverApplication]);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn("flex min-w-0 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[var(--surface-2)]", compact && "lg:justify-center")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Image src={portal.logo} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl object-cover" priority />
        <span className={cn("min-w-0 flex-1", compact && "lg:hidden")}><span className="block truncate text-sm font-semibold">{portal.name}</span><span className="block truncate text-xs text-secondary">{portal.label} workspace</span></span><ChevronDown className={cn("h-4 w-4 shrink-0 text-tertiary transition", open && "rotate-180", compact && "lg:hidden")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="surface absolute left-0 top-[calc(100%+8px)] z-50 w-[310px] overflow-hidden rounded-xl p-2 shadow-elevated"
          >
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold tracking-[0.08em] text-tertiary">Switch workspace</p>
            {available.map((item) => (
              <Link
                role="menuitem"
                key={item.id}
                href={spotlyPortalUrl(item.id)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-[var(--surface-2)]"
              >
                <Image src={item.logo} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block truncate text-xs text-secondary">{item.description}</span>
                </span>
                {portal.id === item.id && <Check className="h-4 w-4 text-[var(--accent)]" />}
              </Link>
            ))}
            {available.length === 1 && <p className="px-3 py-3 text-xs leading-5 text-secondary">Additional workspaces appear only when access is assigned.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;
  const options = [
    { value: "system", label: "System", icon: Laptop },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon }
  ];

  return (
    <div ref={ref} className="relative">
      <button aria-label="Appearance" onClick={() => setOpen((value) => !value)} className="surface flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-2)]"><Icon className="h-5 w-5" /></button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="surface absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-2xl p-2 shadow-elevated">
            {options.map((option) => {
              const OptionIcon = option.icon;
              return (
                <button key={option.value} onClick={() => { setTheme(option.value); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-[var(--surface-2)]">
                  <OptionIcon className="h-4 w-4" />
                  <span className="flex-1 text-left font-medium">{option.label}</span>
                  {theme === option.value && <Check className="h-4 w-4 text-[var(--accent)]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function notificationTime(value, nowMs = 0) {
  if (!value) return "Just now";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  if (!nowMs) return "Recently";
  const minutes = Math.max(0, Math.round((nowMs - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function notificationIcon(item = {}) {
  if (isReviewNotification(item)) return ClipboardCheck;
  const target = notificationWorkspace(item);
  if (target === "business") return Store;
  if (target === "driver") return Bike;
  if (target === "staff") return UsersRound;
  if (target === "admin") return ShieldCheck;
  if (target === "customer") return PackageCheck;
  return Activity;
}

function NotificationPanel({ items, open, onClose, onRead, onReadAll, workspace, error = "" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [clock, setClock] = useState(0);
  const [filter, setFilter] = useState("all");
  const scoped = filter === "workspace" ? items.filter((item) => notificationWorkspace(item) === workspace) : filter === "reviews" ? items.filter(isReviewNotification) : items;
  const unread = scoped.filter((item) => !item.read).length;
  useEffect(() => {
    if (!open) return undefined;
    const update = () => setClock(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [open]);

  async function openItem(item) {
    if (!item.read) await onRead(item.id);
    onClose();
    if (item.href) {
      const href = resolveSpotlyHref(item.href, { currentPortal: workspace, legacyMode: isLegacyPortalPath(workspace, pathname) });
      if (/^https?:/i.test(href)) window.location.assign(href);
      else router.push(href);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title="Notifications" description={unread ? `${unread} unread ${unread === 1 ? "update" : "updates"}` : "You’re all caught up"} mode="drawer" label="Notifications">
      <div className="border-b px-5 py-3">
        <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold tracking-[0.08em] text-tertiary">Recent</span><button type="button" disabled={!unread} onClick={onReadAll} className="text-sm font-semibold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40">Mark all read</button></div>
        <div className="mt-3 flex gap-2 overflow-x-auto">{[["all", "All"], ["workspace", "This workspace"], ["reviews", "Reviews"]].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", filter === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-secondary")}>{label}</button>)}</div>
      </div>
      <div className="p-3">
        {error ? <div className="rounded-xl border border-danger/25 bg-[var(--danger-soft)] p-4"><p className="text-sm font-semibold text-danger">Notifications could not be refreshed</p><p className="mt-1 text-xs leading-5 text-secondary">{error}</p></div> : scoped.length ? scoped.map((item) => { const ItemIcon = notificationIcon(item); return (
          <button key={item.id} type="button" onClick={() => openItem(item)} className="flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--surface-2)]">
            <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", !item.read ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-2)] text-secondary")}><ItemIcon className="h-5 w-5" />{!item.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{item.title || "Spotly update"}</span>
              <span className="mt-1 block text-sm leading-5 text-secondary">{item.body || item.message || "Open this update for more information."}</span>
              <span className="mt-2 block text-xs text-tertiary">{notificationTime(item.createdAt, clock)} · {notificationWorkspace(item)}{isReviewNotification(item) ? " · Review" : ""}</span>
            </span>
          </button>
        ); }) : <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Bell className="h-6 w-6" /></span><p className="mt-4 font-semibold">No notifications yet</p><p className="mt-2 max-w-xs text-sm leading-6 text-secondary">Order updates, verification decisions, support replies, and account changes will appear here.</p></div>}
      </div>
    </Overlay>
  );
}

function CommandPalette({ portal, open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const commands = useMemo(() => portal.nav.map((item) => ({ label: item.label, detail: `Open in ${portal.name}`, href: item.href, icon: item.icon })), [portal]);
  const filtered = commands.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));

  function closePalette() { setQuery(""); onClose(); }
  function navigate(href) { closePalette(); router.push(href); }

  return (
    <Overlay open={open} onClose={closePalette} title={`Go to a page in ${portal.name}`} description="Search this workspace’s available destinations." size="md" label="Workspace navigation">
      <div className="flex items-center gap-3 border-b px-5">
        <Search className="h-5 w-5 text-tertiary" />
        <input data-autofocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a page name…" className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tertiary" />
      </div>
      <div className="max-h-[58vh] overflow-y-auto p-2">
        {filtered.map((item) => { const Icon = item.icon; return (
          <button key={`${item.label}-${item.href}`} onClick={() => navigate(item.href)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[var(--surface-2)]">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block truncate text-xs text-secondary">{item.detail}</span></span>
            <Command className="h-4 w-4 text-tertiary" />
          </button>
        ); })}
        {!filtered.length && <p className="px-4 py-12 text-center text-sm text-secondary">No matching pages.</p>}
      </div>
    </Overlay>
  );
}

function UserMenu({ portal }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { user, profile, logout } = useAuth();
  const displayName = profile?.displayName || user?.displayName || user?.email || "Spotly user";
  const role = portal.id === "admin" ? (profile?.roles?.find((item) => item !== "customer") || "Administrator") : portal.id === "staff" ? (profile?.roles?.find((item) => item !== "customer") || "Spotly staff") : portal.id === "business" ? "Business workspace" : "Spotly member";
  useOutsideClick(ref, () => setOpen(false));
  async function signOutNow() {
    await logout();
    window.location.href = spotlyPortalUrl("customer");
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((value) => !value)} className="flex h-11 items-center gap-2 rounded-xl p-1 pr-2 hover:bg-[var(--surface-2)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--on-accent)]">{initials(displayName)}</span>
        <ChevronDown className="hidden h-4 w-4 text-tertiary sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="surface absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl p-2 shadow-elevated">
            <div className="border-b px-3 py-3">
              <p className="truncate font-semibold">{displayName}</p>
              <p className="mt-1 truncate text-xs text-secondary">{user?.email || role}</p>
              <p className="mt-1 text-[11px] font-semibold capitalize text-tertiary">{role.replaceAll("_", " ")}</p>
            </div>
            <Link href={spotlyPortalUrl("customer", "/account")} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)]"><UserRound className="h-4 w-4" /> Account</Link>
            {WORKSPACE_SETTINGS_ROUTES[portal.id] && <Link href={resolveSpotlyHref(WORKSPACE_SETTINGS_ROUTES[portal.id], { currentPortal: portal.id, legacyMode: isLegacyPortalPath(portal.id, pathname) })} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)]"><Settings className="h-4 w-4" /> Workspace settings</Link>}
            <button type="button" onClick={signOutNow} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-[var(--danger-soft)]"><LogOut className="h-4 w-4" /> Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ portal, activeSection, mobileOpen, onMobileClose, footer = true, collapsed = false, onToggleCollapse }) {
  const groups = useMemo(() => {
    const result = [];
    for (const item of portal.nav) {
      const label = item.group || "Workspace";
      let group = result.find((entry) => entry.label === label);
      if (!group) { group = { label, items: [] }; result.push(group); }
      group.items.push(item);
    }
    return result;
  }, [portal.nav]);
  return (
    <>
      <AnimatePresence>{mobileOpen && <motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/35 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onMobileClose} />}</AnimatePresence>
      <aside className={cn("surface fixed inset-y-0 left-0 z-50 flex w-[278px] flex-col border-y-0 border-l-0 transition-[width,transform] duration-300 lg:translate-x-0", collapsed && "lg:w-[88px]", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-20 items-center px-3">
          <PortalSwitcher portal={portal} compact={collapsed} />
          <button className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--surface-2)] lg:hidden" onClick={onMobileClose} aria-label="Close navigation"><X className="h-5 w-5" /></button>
        </div>
        <nav aria-label={`${portal.name} navigation`} className="no-scrollbar flex-1 overflow-y-auto px-3 py-2">
          {groups.map((group) => <div key={group.label} className="mb-5 last:mb-0">
            <p className={cn("px-3 pb-2 pt-1 text-[11px] font-semibold tracking-[0.08em] text-tertiary", collapsed && "lg:sr-only")}>{group.label}</p>
            <div className="space-y-1">{group.items.map((item) => {
              const Icon = item.icon; const active = activeSection === item.id;
              return <Link key={item.id} href={item.href} onClick={onMobileClose} title={collapsed ? item.label : undefined} className={cn("relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition", collapsed && "lg:justify-center lg:px-0", active ? "text-[var(--accent-strong)] dark:text-[var(--accent)]" : item.emphasis ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-secondary hover:bg-[var(--surface-2)] hover:text-[var(--text)]")}>
                {active && <motion.span layoutId={`sidebar-${portal.id}`} className="absolute inset-0 rounded-xl bg-[var(--accent-soft)]" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <Icon className="relative h-5 w-5 shrink-0" /><span className={cn("relative flex-1", collapsed && "lg:hidden")}>{item.label}</span>{item.badge ? <Badge className={cn("relative min-w-6 justify-center px-1.5", collapsed && "lg:absolute lg:right-0 lg:top-0 lg:min-w-4 lg:px-1 lg:text-[9px]")} tone={active ? "accent" : "neutral"}>{item.badge}</Badge> : null}
              </Link>;
            })}</div>
          </div>)}
        </nav>
        <div className="border-t p-3">
          <button type="button" onClick={onToggleCollapse} className="hidden w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary hover:bg-[var(--surface-2)] lg:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen className="mx-auto h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse sidebar</span></>}</button>
          {footer && <Link href={spotlyPortalUrl("customer", "/support")} onClick={onMobileClose} className={cn("mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary hover:bg-[var(--surface-2)]", collapsed && "lg:justify-center lg:px-0")} title={collapsed ? "Help and support" : undefined}><Activity className="h-4 w-4" /><span className={cn(collapsed && "lg:hidden")}>Help and support</span></Link>}
        </div>
      </aside>
    </>
  );
}

function MobileBottomNav({ portal, activeSection, onOpenCommand }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = portal.nav.slice(0, 4);
  const remaining = portal.nav.slice(4);
  return (
    <>
      <nav className="surface safe-bottom fixed inset-x-0 bottom-0 z-30 flex min-h-[70px] items-start justify-around border-x-0 border-b-0 px-2 pt-2 lg:hidden" aria-label="Mobile navigation">
        {primary.map((item) => { const Icon = item.icon; const active = item.id === activeSection; return <Link key={item.id} href={item.href} className={cn("relative flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium", active ? "text-[var(--accent)]" : "text-tertiary")}><Icon className="h-5 w-5" /><span className="max-w-[70px] truncate">{item.label}</span>{item.badge ? <span className="absolute right-1 top-0 min-w-4 rounded-full bg-danger px-1 text-center text-[9px] font-bold text-[var(--on-danger)]">{item.badge}</span> : null}</Link>; })}
        <button type="button" onClick={() => setMoreOpen(true)} className={cn("flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium", remaining.some((item) => item.id === activeSection) ? "text-[var(--accent)]" : "text-tertiary")}><MoreHorizontal className="h-5 w-5" /><span>More</span></button>
      </nav>
      <Overlay open={moreOpen} onClose={() => setMoreOpen(false)} title="More" description={`More destinations in ${portal.name}.`} mode="sheet" label="More navigation">
        <div className="grid grid-cols-2 gap-2 p-4">
          <button type="button" onClick={() => { setMoreOpen(false); onOpenCommand(); }} className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium"><Search className="h-5 w-5" />Go to a page</button>
          {remaining.map((item) => { const Icon=item.icon; return <Link key={item.id} href={item.href} onClick={() => setMoreOpen(false)} className={cn("flex items-center gap-3 rounded-lg border p-3 text-sm font-medium", item.id === activeSection && "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]")}><Icon className="h-5 w-5" />{item.label}</Link>; })}
        </div>
      </Overlay>
    </>
  );
}

export function PortalShell({ portalId, activeSection, children, hideSidebar = false, navigation = null, footer = true, notificationBusinessId = null }) {
  const basePortal = portals[portalId];
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const portal = useMemo(() => {
    let rawNavigation = navigation || basePortal.nav;
    if (!navigation && portalId === "admin") {
      const sections = adminSectionsForProfile(profile);
      rawNavigation = basePortal.nav.filter((item) => sections.has(item.id));
    }
    return { ...basePortal, href: spotlyPortalUrl(portalId), nav: resolvePortalNavigation(portalId, rawNavigation, pathname) };
  }, [basePortal, portalId, profile, navigation, pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState("");
  const unreadCount = notifications.filter((item) => !item.read).length;
  const attentionNotification = notifications.find((item) => !item.read
    && notificationWorkspace(item) === portalId
    && (!notificationBusinessId || item.businessId === notificationBusinessId)
    && (["high", "critical"].includes(item.importance) || isReviewNotification(item)));

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("spotly-sidebar-collapsed") === "1");
  }, []);
  function toggleSidebar() {
    setSidebarCollapsed((current) => { const next = !current; window.localStorage.setItem("spotly-sidebar-collapsed", next ? "1" : "0"); return next; });
  }

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setNotificationsError("");
      return undefined;
    }
    return subscribeNotifications(user.uid, (items) => { setNotifications(items); setNotificationsError(""); }, (reason) => setNotificationsError(reason?.message || "Spotly could not refresh notifications."));
  }, [user?.uid]);

  async function readNotification(id) {
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    try { await markNotificationRead(id); } catch {}
  }

  async function readAllNotifications() {
    const ids = notifications.filter((item) => !item.read).map((item) => item.id);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    await Promise.allSettled(ids.map((id) => markNotificationRead(id)));
  }

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div data-workspace={portal.id} className="min-h-screen bg-[var(--grouped)]">
      {!hideSidebar && <Sidebar portal={portal} activeSection={activeSection} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} footer={footer} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />}
      <div className={cn(!hideSidebar && (sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[278px]"), "transition-[padding] duration-300")}>
        <header className={cn("surface sticky top-0 z-30 flex h-20 items-center gap-3 border-x-0 border-t-0 px-4 sm:px-6", hideSidebar && "justify-between")}>
          {!hideSidebar && <button aria-label="Open navigation" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-2)] lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>}
          {hideSidebar && <PortalSwitcher portal={portal} />}
          <button onClick={() => setCommandOpen(true)} className="surface hidden h-11 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-xl px-3 text-left text-sm text-secondary hover:bg-[var(--surface-2)] sm:flex">
            <Search className="h-4 w-4" />
            <span className="truncate">Go to a page or action</span>
            <kbd className="ml-auto rounded-lg border bg-[var(--surface-2)] px-2 py-1 text-[11px] text-tertiary">⌘ K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeMenu />
            <button aria-label={`${unreadCount} notifications`} onClick={() => setNotificationsOpen(true)} className="surface relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-2)]">
              <Bell className="h-5 w-5" />
              {unreadCount ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-[var(--surface)]" /> : null}
            </button>
            <UserMenu portal={portal} />
          </div>
        </header>
        {attentionNotification && <div className="border-b bg-[var(--accent-soft)] px-4 py-3 sm:px-6"><div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--accent-strong)]">New activity · {attentionNotification.title || "Spotly update"}</p><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-secondary">{attentionNotification.body || "Open this update for details."}</p></div><div className="flex gap-2">{attentionNotification.href && <button type="button" onClick={async () => { await readNotification(attentionNotification.id); window.location.href = resolveSpotlyHref(attentionNotification.href, { currentPortal: portalId, legacyMode: isLegacyPortalPath(portalId, pathname) }); }} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--on-accent)]">View update</button>}<button type="button" onClick={() => readNotification(attentionNotification.id)} className="rounded-lg border bg-[var(--surface)] px-3 py-2 text-xs font-semibold">Dismiss</button></div></div></div>}
        <main key={pathname} className={cn("portal-gradient min-h-[calc(100vh-5rem)]", !hideSidebar && "pb-24 lg:pb-8")}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
            {children}
          </motion.div>
        </main>
      </div>
      {!hideSidebar && <MobileBottomNav portal={portal} activeSection={activeSection} onOpenCommand={() => setCommandOpen(true)} />}
      <NotificationPanel items={notifications} open={notificationsOpen} onClose={() => setNotificationsOpen(false)} onRead={readNotification} onReadAll={readAllNotifications} workspace={portalId} error={notificationsError} />
      <CommandPalette portal={portal} open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
