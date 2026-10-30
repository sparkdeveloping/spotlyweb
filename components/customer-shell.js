"use client";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleUserRound, Heart, Home, MapPin, Search, TimerReset } from "lucide-react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ThemeMenu } from "@/components/theme-menu";
import { BrandLockup } from "@/components/brand-lockup";
import { NotificationBell } from "@/components/notification-center";
import { cn } from "@/lib/cn";
import { spotlyPortalUrl } from "@/lib/spotly-domains";
import { productServiceId } from "@/lib/spotly-products";

const navItems = [
  { id: "home", label: "Home", icon: Home, href: "/" },
  { id: "search", label: "Search", icon: Search, href: "/search" },
  { id: "activity", label: "Activity", icon: TimerReset, href: "/activity" },
  { id: "saved", label: "Saved", icon: Heart, href: "/saved" },
  { id: "profile", label: "Profile", icon: CircleUserRound, href: "/account" }
];

function initials(profile, user) {
  const label = profile?.displayName || user?.displayName || user?.email || "Spotly";
  return label.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function CustomerShell({
  current = "home",
  user,
  profile,
  locationLabel = "Harare",
  onHome,
  onSearch,
  onActivity,
  onSaved,
  onLocation,
  activityCount = 0,
  locationPanel,
  children,
  footer = true,
  mainClassName,
  immersive = false
}) {
  const router = useRouter();
  const pathname = usePathname();
  const service = productServiceId(pathname);
  const selected = service ? null : current;

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      if (onSearch) onSearch(); else router.push("/search");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSearch, router]);

  function activate(id, event) {
    const handlers = { home: onHome, search: onSearch, activity: onActivity, saved: onSaved };
    if (handlers[id]) {
      event?.preventDefault();
      handlers[id]();
    }
  }

  if (immersive) return <div className="experience-customer min-h-screen bg-[var(--background)] text-[var(--text)]"><EmailVerificationBanner /><main id="spotly-main" tabIndex={-1}>{children}</main></div>;

  return <div className="experience-customer min-h-screen bg-[var(--background)] text-[var(--text)]">
    <a href="#spotly-main" className="experience-skip-link">Skip to content</a>
    <header className="customer-topbar sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-2xl">
      <div className="customer-shell-grid mx-auto flex h-[72px] max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:min-w-[350px]">
          <Link href="/" onClick={(event) => activate("home", event)} className="experience-home-brand flex shrink-0 items-center gap-2.5" aria-label="Spotly home">
            <BrandLockup priority className="experience-main-logo h-11 w-[118px]" />
            
          </Link>
          <Link href="/search" onClick={(event) => { if (onSearch) { event.preventDefault(); onSearch(); } }} className="hidden h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 text-left text-sm text-[var(--text-3)] transition hover:border-[var(--border)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] lg:flex">
            <Search className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">Search Spotly</span>
            <kbd className="ml-auto rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-3)]">/</kbd>
          </Link>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Primary customer navigation">
          {navItems.filter((item) => ["home", "activity", "saved"].includes(item.id)).map((item) => {
            const Icon = item.icon; const active = selected === item.id;
            return <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} onClick={(event) => activate(item.id, event)} className={cn("relative flex h-11 min-w-[92px] items-center justify-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]", active ? "text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]")}>
              {active ? <motion.span layoutId="customer-primary-nav" className="absolute inset-0 rounded-[12px] bg-[var(--accent-soft)]" transition={{ type: "spring", bounce: 0.12, duration: 0.42 }} /> : null}
              <Icon className="relative h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.9} />
              <span className="relative">{item.label}</span>
              {item.id === "activity" && activityCount > 0 ? <span className="relative flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--on-accent)]">{Math.min(activityCount, 99)}</span> : null}
            </Link>;
          })}
        </nav>

        <div className="experience-header-utilities ml-auto flex items-center justify-end gap-2 lg:min-w-[350px]">
          <Link href="/search" aria-label="Search Spotly" onClick={(event) => { if (onSearch) { event.preventDefault(); onSearch(); } }} className="experience-compact-search"><Search className="h-5 w-5" /></Link>
          {onLocation ? <button type="button" onClick={onLocation} className="experience-mobile-location" aria-label={`Change location, currently ${locationLabel}`}><MapPin className="h-4 w-4" /><span>{locationLabel}</span></button> : null}
          {onLocation ? <button type="button" onClick={onLocation} className="hidden max-w-[170px] items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] lg:flex">
            <MapPin className="h-4 w-4 text-[var(--accent)]" />
            <span className="truncate">{locationLabel}</span>
          </button> : <span className="hidden max-w-[170px] items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--text-2)] lg:flex"><MapPin className="h-4 w-4 text-[var(--accent)]" /><span className="truncate">{locationLabel}</span></span>}
          {user && !user.isAnonymous ? <NotificationBell workspace="customer" /> : <ThemeMenu />}
          <Link href={user && !user.isAnonymous ? "/account" : "/login?next=%2F"} className={cn("flex h-11 items-center gap-2 rounded-[12px] p-1.5 pr-2.5 transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]", current === "profile" && "bg-[var(--accent-soft)] text-[var(--accent-strong)]")} aria-label={user && !user.isAnonymous ? "Open profile" : "Sign in"}>
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[11px] font-bold text-[var(--on-accent)]">{user && !user.isAnonymous ? initials(profile, user) : <CircleUserRound className="h-5 w-5" />}</span>
            <span className="hidden max-w-24 truncate text-sm font-semibold xl:block">{user && !user.isAnonymous ? profile?.displayName?.split(" ")[0] || "Profile" : "Sign in"}</span>
          </Link>
        </div>
      </div>
      {locationPanel}
    </header>
    <EmailVerificationBanner />

    <main id="spotly-main" tabIndex={-1} className={cn("v7-page-enter mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-14", mainClassName)}>{children}</main>

    {footer ? <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface)] pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 py-8 text-sm text-[var(--text-3)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2"><Image src="/api/branding/assets/primary_symbol_color.svg" alt="" width={26} height={26} /><span>Spotly · Your city, in one place.</span></div>
        <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href={spotlyPortalUrl("business")}>For businesses</Link><Link href="/drive">Drive & deliver</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/branding">Brand & media</Link></div>
      </div>
    </footer> : null}

    <nav className="customer-mobile-nav safe-bottom fixed inset-x-2 bottom-2 z-40 grid h-[68px] grid-cols-5 items-start rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-1.5 pt-1.5 shadow-elevated backdrop-blur-2xl md:hidden" aria-label="Mobile customer navigation">
      {navItems.map((item) => { const Icon = item.icon; const active = selected === item.id; return <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} onClick={(event) => activate(item.id, event)} className={cn("relative flex min-w-0 flex-col items-center gap-1 rounded-[12px] px-1 py-1.5 text-[10px] font-semibold transition", active ? "text-[var(--accent)]" : "text-[var(--text-3)]")}>
        {active ? <motion.span layoutId="customer-mobile-nav" className="absolute inset-0 rounded-[12px] bg-[var(--accent-soft)]" transition={{ type: "spring", bounce: 0.12, duration: 0.42 }} /> : null}
        <span className="relative"><Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.9} />{item.id === "activity" && activityCount > 0 ? <span className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--on-accent)]">{Math.min(activityCount, 9)}</span> : null}</span>
        <span className="relative truncate">{item.label}</span>
      </Link>; })}
    </nav>
  </div>;
}
