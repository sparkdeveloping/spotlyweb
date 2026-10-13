"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Gift, Share2, UsersRound } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { useToast } from "@/components/providers";
import { Button, Card } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { track } from "@/lib/firebase-services";
import { formatCurrency } from "@/lib/format";

function statusLabel(status) {
  if (status === "qualified") return "Qualified";
  if (status === "pending_first_purchase") return "Waiting for first paid purchase";
  return String(status || "Pending").replaceAll("_", " ");
}

export function ReferralApp() {
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

  return <AuthGate><main className="min-h-screen bg-grouped text-ink"><header className="border-b bg-[var(--surface)]"><div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="Spotly" width={40} height={40} /><span className="text-lg font-semibold">Referrals</span></Link><Button asChild variant="outline"><Link href="/account"><ArrowLeft className="h-4 w-4" />Account</Link></Button></div></header><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.12em] text-violet">Spotly referrals</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Invite people you know.</h1><p className="mt-3 text-sm leading-7 text-secondary">Share your personal code. Referral eligibility is tracked after the invited customer completes their first eligible paid Spotly purchase. Any reward amount is shown only when Spotly has an active referral campaign.</p>{data?.campaign ? <div className="mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-[var(--success-soft)] px-3 py-2 text-xs font-semibold text-[var(--success)]"><Gift className="h-4 w-4" />Current campaign: earn {formatCurrency(data.campaign.referrerReward, data.campaign.currency)} when an eligible invite qualifies{data.campaign.refereeReward > 0 ? ` · invited customers can receive ${formatCurrency(data.campaign.refereeReward, data.campaign.currency)}` : ""}</div> : null}</div>
    {error ? <div role="alert" className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm">{error}</div> : null}
    {loading ? <Card className="mt-6 p-6"><div className="h-24 animate-pulse rounded-xl bg-[var(--surface-2)]" /></Card> : data ? <>
      <Card className="mt-6 overflow-hidden"><div className="grid gap-0 md:grid-cols-[1.2fr_.8fr]"><div className="p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-soft text-violet"><Gift className="h-6 w-6" /></div><p className="mt-5 text-sm font-medium text-secondary">Your referral code</p><div className="mt-2 flex flex-wrap items-center gap-3"><span className="font-mono text-3xl font-semibold tracking-[.12em]">{data.code}</span><button type="button" onClick={() => copy(data.code, "Referral code")} className="flex h-10 w-10 items-center justify-center rounded-xl border hover:bg-[var(--surface-2)]" aria-label="Copy referral code"><Copy className="h-4 w-4" /></button></div><div className="mt-5 flex flex-wrap gap-3"><Button onClick={share}><Share2 className="h-4 w-4" />Share invite</Button><Button variant="outline" onClick={() => copy(shareUrl, "Referral link")}><Copy className="h-4 w-4" />Copy link</Button></div></div><div className="border-t bg-[var(--surface-2)] p-6 md:border-l md:border-t-0"><p className="text-sm font-semibold">Your invites</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xl font-semibold">{data.stats?.invited || 0}</p><p className="mt-1 text-[11px] text-tertiary">Invited</p></div><div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xl font-semibold">{data.stats?.qualified || 0}</p><p className="mt-1 text-[11px] text-tertiary">Qualified</p></div><div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xl font-semibold">{data.stats?.pending || 0}</p><p className="mt-1 text-[11px] text-tertiary">Pending</p></div></div></div></div></Card>
      {!data.claim ? <Card className="mt-5 p-6"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 text-violet" /><div><h2 className="font-semibold">Were you invited?</h2><p className="mt-1 text-sm leading-6 text-secondary">Attach the inviter's code before your first qualifying purchase. One referral code can be attached to an account.</p></div></div><form onSubmit={claim} className="mt-5 flex flex-col gap-2 sm:flex-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} className="field-control min-w-0 flex-1 font-mono uppercase tracking-[.08em]" placeholder="Referral code" /><Button type="submit" loading={saving}>Apply code</Button></form></Card> : <Card className="mt-5 p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]"><Check className="h-5 w-5" /></span><div><h2 className="font-semibold">Inviter connected</h2><p className="mt-1 text-sm text-secondary">Code {data.claim.code} · {statusLabel(data.claim.status)}</p></div></div></Card>}
      {data.rewards?.length ? <Card className="mt-5 p-6"><div className="flex items-start gap-3"><Gift className="mt-0.5 h-5 w-5 text-violet" /><div><h2 className="font-semibold">Referral rewards</h2><p className="mt-1 text-sm leading-6 text-secondary">Rewards are created only after an eligible paid purchase qualifies. Pending rewards may require review before they can be used.</p></div></div><div className="mt-4 divide-y">{data.rewards.slice(0, 20).map((reward) => <div key={reward.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{reward.role === "referrer" ? "Invite reward" : "Welcome reward"}</p><p className="mt-1 text-xs text-tertiary">{reward.createdAt ? new Date(reward.createdAt).toLocaleDateString("en-ZW", { dateStyle: "medium" }) : "Recently earned"}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatCurrency(reward.amount, reward.currency)}</p><p className="mt-1 text-xs capitalize text-secondary">{String(reward.status || "pending").replaceAll("_", " ")}</p></div></div>)}</div></Card> : null}
      {data.referrals?.length ? <Card className="mt-5 p-6"><h2 className="font-semibold">Invite activity</h2><div className="mt-4 divide-y">{data.referrals.slice(0, 20).map((item, index) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">Invite {data.referrals.length - index}</p><p className="mt-1 text-xs text-tertiary">{item.claimedAt ? new Date(item.claimedAt).toLocaleDateString("en-ZW", { dateStyle: "medium" }) : "Recently claimed"}</p></div><span className="text-xs font-semibold text-secondary">{statusLabel(item.status)}</span></div>)}</div></Card> : null}
    </> : null}
  </div></main></AuthGate>;
}
