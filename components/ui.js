"use client";

import Link from "next/link";
import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, LoaderCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Button({ children, variant = "primary", size = "md", className, loading = false, disabled, type = "button", asChild = false, ...props }) {
  const variants = {
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-sm",
    secondary: "bg-[var(--accent-soft)] text-[var(--accent-strong)] dark:text-[var(--accent)] hover:brightness-[0.97] border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))]",
    outline: "surface hover:bg-[var(--surface-2)]",
    ghost: "hover:bg-[var(--surface-2)]",
    danger: "bg-danger text-white hover:bg-red-700",
    success: "bg-success text-white hover:bg-green-700"
  };
  const sizes = {
    sm: "h-10 rounded-lg px-3.5 text-sm",
    md: "h-[50px] rounded-lg px-5 text-[15px]",
    lg: "h-14 rounded-xl px-6 text-base",
    icon: "h-11 w-11 rounded-lg"
  };
  const isDisabled = Boolean(disabled || loading);
  const classes = cn("inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", variants[variant], sizes[size], className);

  if (asChild && isValidElement(children)) {
    const childProps = {
      ...props,
      className: cn(classes, children.props.className),
      "aria-disabled": isDisabled || undefined,
      tabIndex: isDisabled ? -1 : children.props.tabIndex,
      onClick: (event) => {
        if (isDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        children.props.onClick?.(event);
        props.onClick?.(event);
      }
    };
    return cloneElement(children, childProps);
  }

  return (
    <button type={type} disabled={isDisabled} className={classes} {...props}>
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ children, className, elevated = false, ...props }) {
  return <div className={cn("surface rounded-xl", elevated ? "shadow-elevated" : "shadow-card", className)} {...props}>{children}</div>;
}

export function SectionCard({ title, description, action, children, className }) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
          <div>
            {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

export function PageHeader({ eyebrow, title, description, actions, compact = false }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-[var(--accent)]">{eyebrow}</p>}
        <h1 className={cn("font-semibold tracking-[-0.025em]", compact ? "text-3xl" : "text-[34px] leading-[1.08]")}>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-6 text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MetricCard({ label, value, delta, hint, icon: Icon, tone = "default", onClick }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-[var(--accent)]";
  const className = cn("surface min-w-0 rounded-xl p-4 text-left shadow-card", onClick && "cursor-pointer hover:bg-[var(--surface-2)]");
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-secondary">{label}</p>
        {Icon && <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-4 w-4" aria-hidden="true" /></span>}
      </div>
      <p className="mt-4 truncate text-[29px] font-semibold tracking-[-0.03em]">{value}</p>
      {(delta || hint) && <p className="mt-2 flex flex-wrap gap-x-2 text-xs"><span className={cn("font-semibold", toneClass)}>{delta}</span><span className="text-tertiary">{hint}</span></p>}
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

const badgeMap = {
  success: "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950/40 dark:text-green-300",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/40 dark:text-red-300",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300",
  neutral: "bg-[var(--surface-2)] text-secondary ring-[var(--border)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] dark:text-[var(--accent)]",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300"
};

export function Badge({ children, tone = "neutral", dot = false, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", badgeMap[tone] || badgeMap.neutral, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function statusTone(status = "") {
  const value = status.toLowerCase();
  if (["active", "online", "operational", "completed", "confirmed", "paid", "approved", "delivered", "connected", "ready"].some((term) => value.includes(term))) return "success";
  if (["critical", "rejected", "failed", "suspended", "disputed", "restricted"].some((term) => value.includes(term))) return "danger";
  if (["pending", "warning", "degraded", "delayed", "hold", "paused", "needs", "investigating", "triaged"].some((term) => value.includes(term))) return "warning";
  if (["new", "preparing", "assigned", "review", "upcoming", "scheduled", "active job", "heading"].some((term) => value.includes(term))) return "info";
  return "neutral";
}

export function StatusBadge({ status }) {
  return <Badge tone={statusTone(status)} dot>{status}</Badge>;
}

export function SearchField({ value, onChange, placeholder = "Search", className, onFocus, shortcut, label = "Search" }) {
  return (
    <label className={cn("surface flex h-[50px] items-center gap-3 rounded-lg px-4 transition focus-within:ring-2 focus-within:ring-[var(--accent)]/30", className)}>
      <span className="sr-only">{label}</span>
      <Search className="h-5 w-5 shrink-0 text-tertiary" aria-hidden="true" />
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
      />
      {value ? (
        <button type="button" aria-label="Clear search" className="rounded-lg p-1 text-tertiary hover:bg-[var(--surface-2)]" onClick={() => onChange?.("")}><X className="h-4 w-4" /></button>
      ) : shortcut ? <kbd className="hidden rounded-lg border bg-[var(--surface-2)] px-2 py-1 text-[11px] text-tertiary sm:block">{shortcut}</kbd> : null}
    </label>
  );
}

export function Tabs({ tabs, value, onChange, className, label = "Sections" }) {
  const tabRefs = useRef([]);
  function onKeyDown(event, index) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    onChange(tabs[next].value);
    requestAnimationFrame(() => tabRefs.current[next]?.focus());
  }
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-[var(--surface-2)] p-1", className)}>
      {tabs.map((tab, index) => (
        <button
          ref={(node) => { tabRefs.current[index] = node; }}
          key={tab.value}
          id={`tab-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          aria-controls={`panel-${tab.value}`}
          tabIndex={value === tab.value ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => onChange(tab.value)}
          className={cn("relative h-10 whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-secondary transition", value === tab.value && "text-[var(--accent-strong)] dark:text-[var(--accent)]")}
        >
          {value === tab.value && <motion.span layoutId="active-tab" className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm" transition={{ type: "spring", bounce: 0.12, duration: 0.4 }} />}
          <span className="relative">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, options, className, ariaLabel = "Select option" }) {
  return (
    <label className={cn("surface relative flex h-11 items-center rounded-lg", className)}>
      <span className="sr-only">{ariaLabel}</span>
      <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} className="h-full appearance-none bg-transparent pl-3 pr-9 text-sm font-medium outline-none">
        {options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-tertiary" aria-hidden="true" />
    </label>
  );
}

export function Modal({ open, onClose, title, description, children, size = "md", closeOnBackdrop = true }) {
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    requestAnimationFrame(() => focusable?.focus());
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab" || !dialog) return;
      const nodes = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.button aria-label="Close dialog" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={closeOnBackdrop ? onClose : undefined} />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ y: 36, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 330, damping: 30 }}
            className={cn("surface relative z-10 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[20px] shadow-elevated sm:rounded-[20px]", widths[size])}
          >
            <div className="flex min-h-16 items-center justify-between gap-4 border-b px-5">
              <div>
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                {description && <p id={descriptionId} className="mt-1 text-sm text-secondary">{description}</p>}
              </div>
              <button aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--surface-2)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="scrollbar-thin overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-6 w-6" /></div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ListRow({ icon: Icon, title, subtitle, trailing, onClick, href, className, ariaLabel }) {
  const interactive = Boolean(onClick || href);
  const content = (
    <>
      {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" aria-hidden="true" /></span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {subtitle && <span className="mt-1 block truncate text-sm text-secondary">{subtitle}</span>}
      </span>
      {trailing || (interactive ? <ChevronRight className="h-4 w-4 text-tertiary" aria-hidden="true" /> : null)}
    </>
  );
  const classes = cn("flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5", interactive && "transition hover:bg-[var(--surface-2)]", className);
  if (href) return <Link href={href} className={classes} aria-label={ariaLabel}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={classes} aria-label={ariaLabel}>{content}</button>;
  return <div className={classes}>{content}</div>;
}

export function ProgressBar({ value, className, color = "var(--accent)", label = "Progress" }) {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded} className={cn("h-2 overflow-hidden rounded-full bg-[var(--surface-2)]", className)}><motion.div initial={{ width: 0 }} animate={{ width: `${bounded}%` }} className="h-full rounded-full" style={{ backgroundColor: color }} /></div>;
}
