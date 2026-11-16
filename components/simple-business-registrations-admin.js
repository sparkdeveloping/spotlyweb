"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Trash2,
  UserRound
} from "lucide-react";
import { Badge, Button, Card, SearchField } from "@/components/ui";
import {
  CONTACT_PREFERENCE_LABELS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUS_OPTIONS,
  ROLE_AT_BUSINESS_LABELS,
  WORKFLOW_STATUS_LABELS,
  registrationStatusTone,
  workflowStatusTone
} from "@/lib/business-registrations.mjs";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

const SESSION_KEY = "spotly-simple-registrations-password";

function formatDateTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function whatsappDigits(phone = "") {
  return String(phone).replace(/[^\d]/g, "");
}

async function apiRequest(method, password, body = null, query = "") {
  const response = await fetch(`/api/public/business-registrations${query}`, {
    method,
    headers: {
      "x-registrations-password": password,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function SimpleBusinessRegistrationsAdmin() {
  const [passwordInput, setPasswordInput] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");

  const [query, setQuery] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [regStatusFilter, setRegStatusFilter] = useState("all");

  const loadRegistrations = useCallback(async (activePassword) => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiRequest("GET", activePassword);
      setRegistrations(payload.registrations || []);
      setUnlocked(true);
      setAuthError("");
      return true;
    } catch (err) {
      if (err.status === 401) {
        if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_KEY);
        setUnlocked(false);
        setPassword("");
        setAuthError(err.message || "Invalid password.");
      } else {
        setError(err.message || "Could not load registrations.");
      }
      return false;
    } finally {
      setLoading(false);
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setAuthChecking(false);
      return;
    }
    const saved = window.sessionStorage.getItem(SESSION_KEY) || "";
    if (!saved) {
      setAuthChecking(false);
      return;
    }
    setPassword(saved);
    loadRegistrations(saved);
  }, [loadRegistrations]);

  async function handleUnlock(event) {
    event.preventDefault();
    const candidate = passwordInput.trim();
    if (!candidate) {
      setAuthError("Enter the password.");
      return;
    }
    setAuthChecking(true);
    setAuthError("");
    const ok = await loadRegistrations(candidate);
    if (ok) {
      setPassword(candidate);
      setPasswordInput("");
      if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_KEY, candidate);
    }
  }

  function handleLock() {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_KEY);
    setPassword("");
    setUnlocked(false);
    setRegistrations([]);
    setAuthError("");
    setError("");
  }

  async function updateRegistration(id, patch) {
    setBusyId(id);
    setError("");
    try {
      const result = await apiRequest("PATCH", password, { id, ...patch });
      setRegistrations((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                seen: result.seen,
                status: result.status,
                seenAt: result.seen ? item.seenAt || new Date().toISOString() : null,
                contactedAt: result.status === "contacted" ? item.contactedAt || new Date().toISOString() : null
              }
            : item
        )
      );
    } catch (err) {
      if (err.status === 401) handleLock();
      else setError(err.message || "Could not update registration.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteRegistration(id) {
    setBusyId(id);
    setError("");
    try {
      await apiRequest("DELETE", password, null, `?id=${encodeURIComponent(id)}`);
      setRegistrations((current) => current.filter((item) => item.id !== id));
      setConfirmDeleteId("");
    } catch (err) {
      if (err.status === 401) handleLock();
      else setError(err.message || "Could not delete registration.");
    } finally {
      setBusyId("");
    }
  }

  const stats = useMemo(() => {
    const total = registrations.length;
    const unseen = registrations.filter((item) => !item.seen && item.status === "new").length;
    const seen = registrations.filter((item) => item.seen && item.status !== "contacted").length;
    const contacted = registrations.filter((item) => item.status === "contacted").length;
    return { total, unseen, seen, contacted };
  }, [registrations]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((item) => {
      if (workflowFilter === "new" && (item.seen || item.status !== "new")) return false;
      if (workflowFilter === "seen" && (!item.seen || item.status === "contacted")) return false;
      if (workflowFilter === "contacted" && item.status !== "contacted") return false;
      if (regStatusFilter !== "all" && item.registrationStatus !== regStatusFilter) return false;
      if (!q) return true;
      const haystack = [
        item.businessName,
        item.applicantName,
        item.phone,
        item.email,
        item.city,
        item.country,
        item.category,
        item.notes
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [registrations, query, workflowFilter, regStatusFilter]);

  if (authChecking && !unlocked) {
    return (
      <main data-workspace="business" className="min-h-screen bg-[var(--background)] px-4 py-20">
        <div className="mx-auto max-w-md text-center text-sm text-secondary">Checking access…</div>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main data-workspace="business" className="min-h-screen bg-[var(--background)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-md">
          <Link href={spotlyPortalUrl("business")} className="text-sm font-medium text-business hover:underline">
            ← Spotly Business
          </Link>
          <Card variant="bordered" className="mt-6 rounded-3xl p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business-soft text-business">
              <LockKeyhole className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Business registrations</h1>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Enter the outreach password to view submitted businesses, contact applicants, and manage entries.
            </p>
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-3 text-sm text-[var(--on-danger-soft)]"
                >
                  {authError}
                </div>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Password</span>
                <input
                  type="password"
                  required
                  autoFocus
                  className="field-control w-full"
                  placeholder="Enter access password"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                />
              </label>
              <Button type="submit" className="w-full" loading={loading}>
                Unlock registrations
              </Button>
            </form>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main data-workspace="business" className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={spotlyPortalUrl("business")} className="text-sm font-medium text-business hover:underline">
              ← Spotly Business
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Business registrations</h1>
            <p className="mt-1 text-sm text-secondary">
              Incoming business onboarding leads for manual outreach.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" loading={loading} onClick={() => loadRegistrations(password)}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLock}>
              <LogOut className="h-4 w-4" />
              Lock
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-semibold text-secondary">Total registrations</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-secondary">Unseen</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--warning)]">{stats.unseen}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-secondary">Seen (to follow up)</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-business">{stats.seen}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-secondary">Contacted</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--success)]">{stats.contacted}</p>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search business registrations"
              placeholder="Search business name, contact person, phone, email, city…"
              className="min-h-[48px] flex-1"
            />
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter by outreach stage"
                className="field-control"
                value={workflowFilter}
                onChange={(event) => setWorkflowFilter(event.target.value)}
              >
                <option value="all">All stages ({stats.total})</option>
                <option value="new">Unseen ({stats.unseen})</option>
                <option value="seen">Seen ({stats.seen})</option>
                <option value="contacted">Contacted ({stats.contacted})</option>
              </select>
              <select
                aria-label="Filter by registration status"
                className="field-control"
                value={regStatusFilter}
                onChange={(event) => setRegStatusFilter(event.target.value)}
              >
                <option value="all">All registration statuses</option>
                {REGISTRATION_STATUS_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]"
          >
            {error}
          </div>
        )}

        {loading && registrations.length === 0 ? (
          <Card className="p-10 text-center text-sm text-secondary">Loading registrations…</Card>
        ) : visible.length === 0 ? (
          <Card className="p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-tertiary" />
            <p className="mt-3 font-semibold">No registrations match your filters</p>
            <p className="mt-1 text-sm text-secondary">
              {registrations.length === 0
                ? "New business submissions from the onboarding page will appear here."
                : "Try clearing the search or filter selections."}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {visible.map((item) => {
              const isBusy = busyId === item.id;
              const isUnseen = !item.seen && item.status === "new";
              const isContacted = item.status === "contacted";
              const wa = whatsappDigits(item.phone);

              return (
                <Card
                  key={item.id}
                  variant="bordered"
                  className={`p-5 transition ${isUnseen ? "border-business/45 ring-1 ring-business/15" : ""}`}
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isUnseen && <span className="h-2.5 w-2.5 rounded-full bg-business" title="Unseen" />}
                        <h2 className="text-lg font-semibold">{item.businessName}</h2>
                        <Badge tone={workflowStatusTone(item.status, item.seen)} dot>
                          {WORKFLOW_STATUS_LABELS[item.status] || (item.seen ? "Seen" : "Unseen")}
                        </Badge>
                        <Badge tone={registrationStatusTone(item.registrationStatus)}>
                          {REGISTRATION_STATUS_LABELS[item.registrationStatus] || item.registrationStatus}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
                        <span>{item.category}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {item.city}, {item.country}
                        </span>
                        <span>Submitted {formatDateTime(item.createdAt)}</span>
                      </div>

                      <div className="grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-tertiary">Contact person</p>
                          <p className="mt-1 flex items-center gap-1.5 font-semibold">
                            <UserRound className="h-3.5 w-3.5 text-business" />
                            {item.applicantName}
                          </p>
                          <p className="mt-0.5 text-xs text-secondary">
                            {ROLE_AT_BUSINESS_LABELS[item.roleAtBusiness] || item.roleAtBusiness}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-tertiary">Phone / WhatsApp</p>
                          <p className="mt-1 font-semibold">{item.phone}</p>
                        </div>

                        <div>
                          <p className="text-xs text-tertiary">Email</p>
                          <p className="mt-1 break-all font-semibold">{item.email || "—"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-tertiary">Preferred contact</p>
                          <p className="mt-1 font-semibold">
                            {CONTACT_PREFERENCE_LABELS[item.contactPreference] || item.contactPreference}
                          </p>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-xs leading-5 text-secondary">
                          <strong className="text-[var(--text)]">Notes:</strong> {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                      <div className="flex flex-wrap gap-2">
                        {wa && (
                          <a
                            href={`https://wa.me/${wa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-[var(--surface)] px-3 text-xs font-semibold hover:bg-[var(--surface-2)]"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-business" />
                            WhatsApp
                          </a>
                        )}
                        {item.phone && (
                          <a
                            href={`tel:${item.phone}`}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-[var(--surface)] px-3 text-xs font-semibold hover:bg-[var(--surface-2)]"
                          >
                            <Phone className="h-3.5 w-3.5 text-business" />
                            Call
                          </a>
                        )}
                        {item.email && (
                          <a
                            href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
                              `Spotly Business — ${item.businessName}`
                            )}`}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-[var(--surface)] px-3 text-xs font-semibold hover:bg-[var(--surface-2)]"
                          >
                            <Mail className="h-3.5 w-3.5 text-business" />
                            Email
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => updateRegistration(item.id, { seen: !item.seen })}
                        >
                          {item.seen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {item.seen ? "Mark unseen" : "Mark as seen"}
                        </Button>

                        <Button
                          size="sm"
                          variant={isContacted ? "secondary" : "primary"}
                          disabled={isBusy}
                          onClick={() =>
                            updateRegistration(item.id, {
                              status: isContacted ? "seen" : "contacted"
                            })
                          }
                        >
                          {isContacted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          {isContacted ? "Contacted" : "Mark contacted"}
                        </Button>

                        {confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="danger"
                              loading={isBusy}
                              onClick={() => deleteRegistration(item.id)}
                            >
                              Confirm delete
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId("")}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="text-danger hover:bg-[var(--danger-soft)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
