"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Gift, Share2, UsersRound } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { CustomerShell } from "@/components/customer-shell";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Button } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { track } from "@/lib/firebase-services";
import { formatCurrency } from "@/lib/format";

function statusLabel(status) {
  if (status === "qualified") return "Qualified";
  if (status === "pending_first_purchase") return "Waiting for first paid purchase";
  return String(status || "Pending").replaceAll("_", " ");
}

function Stat({ value, label }) {
  return <div className="min-w-0 border-r border-[var(--border-subtle)] pr-4 last:border-r-0 last:pr-0"><p className="text-2xl font-semibold tracking-[-.035em]">{value}</p><p className="mt-1 text-xs text-[var(--text-3)]">{label}</p></div>;
}

export function ReferralApp() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setData(await authenticatedFetch("/api/customer/referrals", { cache: "no-store" })); }
    catch (reason) { setError(reason.message || "Referrals could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const shareUrl = useMemo(() => {
    if (!data?.code) return "";
    const base = typeof window === "undefined" ? "https://spotlyafrica.com" : window.location.origin;
    return `${base}/referrals?code=${encodeURIComponent(data.code)}`;
  }, [data?.code]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const incoming = new URLSearchParams(window.location.search).get("code");
    if (incoming) setCode(incoming.toUpperCase());
  }, []);

  async function copy(value, label) {
    try { await navigator.clipboard.writeText(value); toast(`${label} copied.`, { type: "success" }); }
    catch { toast("Copy is not available in this browser.", { type: "error" }); }
  }

  async function share() {
    if (!shareUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Spotly", text: `Use my Spotly referral code ${data.code}`, url: shareUrl }); track("referral_shared", { method: "native_share" }); return; } catch {}
    }
    await copy(shareUrl, "Referral link");
    track("referral_shared", { method: "copy_link" });
  }

  async function claim(event) {
    event.preventDefault();
    if (!code.trim()) return;
    setSaving(true); setError("");
    try {
      const result = await authenticatedFetch("/api/customer/referrals", { method: "POST", body: JSON.stringify({ action: "claim", code: code.trim().toUpperCase() }) });
      setData(result); track("referral_claimed", { status: result.claim?.status || "pending" });
      toast("Referral code attached to your account.", { type: "success", title: "Referral saved" });
    } catch (reason) { setError(reason.message || "That referral code could not be saved."); }
    finally { setSaving(false); }
  }

  const locationLabel = profile?.preferences?.preferredCity || "Harare";

  return <AuthGate><CustomerShell current="profile" user={user} profile={profile} locationLabel={locationLabel}>
    <div className="v7-page-enter mx-auto max-w-5xl">
      <div className="border-b border-[var(--border-subtle)] pb-7">
        <p className="text-sm font-semibold text-[var(--accent)]">Referrals</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Bring someone into Spotly.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-2)]">Share your personal invite. Spotly only marks a referral qualified after the invited customer completes an eligible paid purchase, so your status always reflects what actually happened.</p>
        {data?.campaign ? <div className="mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-[var(--success-soft)] px-3 py-2 text-xs font-semibold text-[var(--success)]"><Gift className="h-4 w-4" />Earn {formatCurrency(data.campaign.referrerReward, data.campaign.currency)} when an eligible invite qualifies{data.campaign.refereeReward > 0 ? ` · they can receive ${formatCurrency(data.campaign.refereeReward, data.campaign.currency)}` : ""}</div> : null}
      </div>

      {error ? <div role="alert" className="mt-5 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm">{error}</div> : null}

      {loading ? <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="v7-skeleton h-64 rounded-[var(--radius-feature)]"/><div className="v7-skeleton h-64 rounded-[var(--radius-feature)]"/></div> : data ? <>
        <section className="mt-7 grid overflow-hidden rounded-[var(--radius-feature)] border border-[var(--border-subtle)] bg-[var(--surface)] lg:grid-cols-[1.2fr_.8fr]">
          <div className="p-6 sm:p-8"><span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent)]"><Gift className="h-6 w-6" /></span><p className="mt-6 text-sm font-medium text-[var(--text-3)]">Your referral code</p><div className="mt-2 flex flex-wrap items-center gap-3"><span className="font-mono text-3xl font-semibold tracking-[.12em]">{data.code}</span><button type="button" onClick={() => copy(data.code, "Referral code")} className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] transition hover:bg-[var(--surface-hover)]" aria-label="Copy referral code"><Copy className="h-4 w-4" /></button></div><p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-2)]">Send this to someone you actually know. They can attach it before their first qualifying purchase.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={share}><Share2 className="h-4 w-4" />Share invite</Button><Button variant="outline" onClick={() => copy(shareUrl, "Referral link")}><Copy className="h-4 w-4" />Copy link</Button></div></div>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-2)] p-6 lg:border-l lg:border-t-0"><p className="text-sm font-semibold">Invite activity</p><div className="mt-6 grid grid-cols-3 gap-4"><Stat value={data.stats?.invited || 0} label="Invited"/><Stat value={data.stats?.qualified || 0} label="Qualified"/><Stat value={data.stats?.pending || 0} label="Pending"/></div></div>
        </section>

        {!data.claim ? <section className="mt-8 border-t border-[var(--border-subtle)] pt-7"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound className="h-5 w-5" /></span><div><h2 className="font-semibold">Were you invited?</h2><p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Attach the inviter&apos;s code before your first qualifying purchase. An account can use one referral code.</p></div></div><form onSubmit={claim} className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} className="field-control min-w-0 flex-1 font-mono uppercase tracking-[.08em]" placeholder="Referral code" /><Button type="submit" loading={saving}>Apply code</Button></form></section> : <section className="mt-8 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-7"><span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--success-soft)] text-[var(--success)]"><Check className="h-5 w-5" /></span><div><h2 className="font-semibold">Inviter connected</h2><p className="mt-1 text-sm text-[var(--text-2)]">Code {data.claim.code} · {statusLabel(data.claim.status)}</p></div></section>}

        {data.rewards?.length ? <section className="mt-9 border-t border-[var(--border-subtle)] pt-7"><div className="flex items-start gap-3"><Gift className="mt-0.5 h-5 w-5 text-[var(--accent)]" /><div><h2 className="text-xl font-semibold tracking-[-.025em]">Referral rewards</h2><p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Only rewards created from eligible purchases appear here.</p></div></div><div className="mt-4 divide-y divide-[var(--border-subtle)]">{data.rewards.slice(0, 20).map((reward) => <div key={reward.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">{reward.role === "referrer" ? "Invite reward" : "Welcome reward"}</p><p className="mt-1 text-xs text-[var(--text-3)]">{reward.createdAt ? new Date(reward.createdAt).toLocaleDateString("en-ZW", { dateStyle: "medium" }) : "Recently earned"}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatCurrency(reward.amount, reward.currency)}</p><p className="mt-1 text-xs capitalize text-[var(--text-2)]">{String(reward.status || "pending").replaceAll("_", " ")}</p></div></div>)}</div></section> : null}

        {data.referrals?.length ? <section className="mt-9 border-t border-[var(--border-subtle)] pt-7"><h2 className="text-xl font-semibold tracking-[-.025em]">People you&apos;ve invited</h2><div className="mt-4 divide-y divide-[var(--border-subtle)]">{data.referrals.slice(0, 20).map((item, index) => <div key={item.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Invite {data.referrals.length - index}</p><p className="mt-1 text-xs text-[var(--text-3)]">{item.claimedAt ? new Date(item.claimedAt).toLocaleDateString("en-ZW", { dateStyle: "medium" }) : "Recently claimed"}</p></div><span className="text-xs font-semibold text-[var(--text-2)]">{statusLabel(item.status)}</span></div>)}</div></section> : null}
      </> : null}
    </div>
  </CustomerShell></AuthGate>;
}
