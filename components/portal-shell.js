"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  Command,
  Laptop,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { portals } from "@/data/portals";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { useTheme } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import { Badge } from "@/components/ui";
import { markNotificationRead, subscribeNotifications } from "@/lib/firebase-services";
import { adminSectionsForProfile } from "@/lib/admin-access";


function useOutsideClick(ref, callback) {
  useEffect(() => {
    function handler(event) {
      if (ref.current && !ref.current.contains(event.target)) callback();
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [callback, ref]);
}

function PortalSwitcher({ portal }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-[var(--surface-2)]"
        aria-expanded={open}
      >
        <Image src={portal.logo} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[14px] object-cover" priority />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{portal.name}</span>
          <span className="block truncate text-xs text-secondary">{portal.label} portal</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-tertiary transition", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="surface absolute left-0 top-[calc(100%+8px)] z-50 w-[310px] overflow-hidden rounded-2xl p-2 shadow-elevated"
          >
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">Switch Spotly app</p>
            {Object.values(portals).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[var(--surface-2)]"
              >
                <Image src={item.logo} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block truncate text-xs text-secondary">{item.description}</span>
                </span>
                {portal.id === item.id && <Check className="h-4 w-4 text-[var(--accent)]" />}
              </Link>
            ))}
            <div className="my-2 border-t" />
            <Link href="/devstatus" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[var(--surface-2)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-soft text-violet"><Activity className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Development status</span><span className="block truncate text-xs text-secondary">Progress, requirements, and launch readiness</span></span>
            </Link>
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

function notificationTime(value) {
  if (!value) return "Just now";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function NotificationPanel({ items, open, onClose, onRead, onReadAll }) {
  const router = useRouter();
  const unread = items.filter((item) => !item.read).length;

  async function openItem(item) {
    if (!item.read) await onRead(item.id);
    onClose();
    if (item.href) router.push(item.href);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button aria-label="Close notifications" className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 34 }} className="surface fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-y-0 border-r-0 shadow-elevated">
            <div className="flex h-20 items-center justify-between border-b px-5">
              <div>
                <h2 className="text-lg font-semibold">Notifications</h2>
                <p className="text-sm text-secondary">{unread ? `${unread} unread ${unread === 1 ? "update" : "updates"}` : "You’re all caught up"}</p>
              </div>
              <button aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-2)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-tertiary">Recent</span>
              <button type="button" disabled={!unread} onClick={onReadAll} className="text-sm font-semibold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40">Mark all read</button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
              {items.length ? items.map((item) => (
                <button key={item.id} type="button" onClick={() => openItem(item)} className="flex w-full gap-3 rounded-2xl p-3 text-left hover:bg-[var(--surface-2)]">
                  <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", !item.read ? "bg-[var(--accent)]" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.title || "Spotly update"}</span>
                    <span className="mt-1 block text-sm leading-5 text-secondary">{item.body || item.message || "Open this update for more information."}</span>
                    <span className="mt-2 block text-xs text-tertiary">{notificationTime(item.createdAt)}</span>
                  </span>
                </button>
              )) : <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Bell className="h-6 w-6" /></span><p className="mt-4 font-semibold">No notifications yet</p><p className="mt-2 max-w-xs text-sm leading-6 text-secondary">Order updates, verification decisions, support replies, and account changes will appear here.</p></div>}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function CommandPalette({ portal, open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const commands = useMemo(() => [
    ...portal.nav.map((item) => ({ label: item.label, detail: portal.name, href: item.href, icon: item.icon })),
    { label: "Development status", detail: "Client progress, requirements, and launch readiness", href: "/devstatus", icon: Activity },
    ...Object.values(portals).filter((item) => item.id !== portal.id).map((item) => ({ label: `Switch to ${item.name}`, detail: item.description, href: item.href, image: item.logo }))
  ], [portal]);
  const filtered = commands.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));

  function closePalette() {
    setQuery("");
    onClose();
  }

  function navigate(href) {
    closePalette();
    router.push(href);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closePalette}>
          <motion.div initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} className="surface w-full max-w-2xl overflow-hidden rounded-[24px] shadow-elevated" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b px-5">
              <Search className="h-5 w-5 text-tertiary" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${portal.name} or switch apps…`} className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tertiary" />
              <kbd className="rounded-lg border bg-[var(--surface-2)] px-2 py-1 text-xs text-tertiary">ESC</kbd>
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-2">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={`${item.label}-${item.href}`} onClick={() => navigate(item.href)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-[var(--surface-2)]">
                    {item.image ? <Image src={item.image} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-secondary">{item.detail}</span>
                    </span>
                    <Command className="h-4 w-4 text-tertiary" />
                  </button>
                );
              })}
              {!filtered.length && <p className="px-4 py-12 text-center text-sm text-secondary">No matching pages or actions.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UserMenu({ portal }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { user, profile, logout } = useAuth();
  const displayName = profile?.displayName || user?.displayName || user?.email || "Spotly user";
  const role = portal.id === "admin" ? (profile?.roles?.find((item) => item !== "customer") || "Administrator") : portal.id === "staff" ? (profile?.roles?.find((item) => item !== "customer") || "Spotly staff") : portal.id === "business" ? "Business workspace" : "Spotly member";
  useOutsideClick(ref, () => setOpen(false));
  async function signOutNow() {
    await logout();
    window.location.href = "/";
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((value) => !value)} className="flex h-11 items-center gap-2 rounded-xl p-1 pr-2 hover:bg-[var(--surface-2)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">{initials(displayName)}</span>
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
            <Link href="/account" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)]"><UserRound className="h-4 w-4" /> Shared account</Link>
            <Link href={`${portal.href}${portal.id === "customer" ? "" : "/settings"}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)]"><Settings className="h-4 w-4" /> Workspace settings</Link>
            <button type="button" onClick={signOutNow} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-red-50 dark:hover:bg-red-950/30"><LogOut className="h-4 w-4" /> Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ portal, activeSection, mobileOpen, onMobileClose, footer = true }) {
  return (
    <>
      <AnimatePresence>
        {mobileOpen && <motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/35 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onMobileClose} />}
      </AnimatePresence>
      <aside className={cn("surface fixed inset-y-0 left-0 z-50 flex w-[278px] flex-col border-y-0 border-l-0 transition-transform duration-300 lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-20 items-center px-3">
          <PortalSwitcher portal={portal} />
          <button className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--surface-2)] lg:hidden" onClick={onMobileClose}><X className="h-5 w-5" /></button>
        </div>
        <nav aria-label={`${portal.name} navigation`} className="no-scrollbar flex-1 overflow-y-auto px-3 py-2">
          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">Workspace</p>
          <div className="space-y-1">
            {portal.nav.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn("relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition", active ? "text-[var(--accent-strong)] dark:text-[var(--accent)]" : item.emphasis ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-secondary hover:bg-[var(--surface-2)] hover:text-[var(--text)]")}
                >
                  {active && <motion.span layoutId={`sidebar-${portal.id}`} className="absolute inset-0 rounded-xl bg-[var(--accent-soft)]" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                  <Icon className="relative h-5 w-5 shrink-0" />
                  <span className="relative flex-1">{item.label}</span>
                  {item.badge ? <Badge className="relative min-w-6 justify-center px-1.5" tone={active ? "accent" : "neutral"}>{item.badge}</Badge> : null}
                </Link>
              );
            })}
          </div>
        </nav>
        {footer && <div className="border-t p-3">
          <div className="rounded-2xl bg-[var(--accent-soft)] p-3">
            <p className="text-xs font-semibold text-[var(--accent-strong)] dark:text-[var(--accent)]">Spotly unified web</p>
            <p className="mt-1 text-xs leading-5 text-secondary">Switch between all five role-specific apps without leaving the platform.</p>
            <Link href="/devstatus" onClick={onMobileClose} className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--accent-strong)] dark:text-[var(--accent)]"><Activity className="h-3.5 w-3.5" />Development status</Link>
          </div>
        </div>}
      </aside>
    </>
  );
}

function MobileBottomNav({ portal, activeSection }) {
  const items = portal.nav.slice(0, 5);
  return (
    <nav className="surface safe-bottom fixed inset-x-0 bottom-0 z-30 flex min-h-[68px] items-start justify-around border-x-0 border-b-0 px-2 pt-2 lg:hidden" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeSection;
        return (
          <Link key={item.id} href={item.href} className={cn("relative flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium", active ? "text-[var(--accent)]" : "text-tertiary")}>
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
            {item.badge ? <span className="absolute right-1 top-0 min-w-4 rounded-full bg-danger px-1 text-center text-[9px] font-bold text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalShell({ portalId, activeSection, children, hideSidebar = false, navigation = null, footer = true }) {
  const basePortal = portals[portalId];
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const portal = useMemo(() => {
    if (navigation) return { ...basePortal, nav: navigation };
    if (portalId !== "admin") return basePortal;
    const sections = adminSectionsForProfile(profile);
    return { ...basePortal, nav: basePortal.nav.filter((item) => sections.has(item.id)) };
  }, [basePortal, portalId, profile, navigation]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return undefined;
    }
    return subscribeNotifications(user.uid, setNotifications, () => setNotifications([]));
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

  const shellStyle = {
    "--accent": portal.accent,
    "--accent-strong": portal.accentStrong,
    "--accent-soft": portal.accentSoft
  };

  return (
    <div style={shellStyle} className="min-h-screen bg-[var(--grouped)]">
      {!hideSidebar && <Sidebar portal={portal} activeSection={activeSection} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} footer={footer} />}
      <div className={cn(!hideSidebar && "lg:pl-[278px]")}> 
        <header className={cn("surface sticky top-0 z-30 flex h-20 items-center gap-3 border-x-0 border-t-0 px-4 sm:px-6", hideSidebar && "justify-between")}>
          {!hideSidebar && <button aria-label="Open navigation" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-2)] lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>}
          {hideSidebar && <PortalSwitcher portal={portal} />}
          <button onClick={() => setCommandOpen(true)} className="surface hidden h-11 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-xl px-3 text-left text-sm text-secondary hover:bg-[var(--surface-2)] sm:flex">
            <Search className="h-4 w-4" />
            <span className="truncate">Search pages, records, and actions</span>
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
        <main key={pathname} className={cn("portal-gradient min-h-[calc(100vh-5rem)]", !hideSidebar && "pb-24 lg:pb-8")}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
            {children}
          </motion.div>
        </main>
      </div>
      {!hideSidebar && <MobileBottomNav portal={portal} activeSection={activeSection} />}
      <NotificationPanel items={notifications} open={notificationsOpen} onClose={() => setNotificationsOpen(false)} onRead={readNotification} onReadAll={readAllNotifications} />
      <CommandPalette portal={portal} open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
