"use client";

import Image from "next/image";
import Link from "next/link";
import { BellRing, Check, Globe2, LockKeyhole, LogOut, Mail, Phone, ShieldCheck, Store, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Button, Card, ListRow, StatusBadge } from "@/components/ui";

function workspaceAccess(profile, memberships) {
  const roles = new Set(profile?.roles || []);
  const items = [{ href: "/marketplace", label: "Personal", description: "Orders, saved businesses and pickup activity", logo: "/brand/spotly.svg" }];
  if (memberships?.length || [...roles].some((role) => /business|owner|branch|merchant|catalog/.test(role))) items.push({ href: "/business", label: "Business", description: "Operate assigned businesses and locations", logo: "/brand/spotly-business.svg" });
  if ([...roles].some((role) => /driver|fleet|dispatch/.test(role))) items.push({ href: "/driver", label: "Driver", description: "Jobs, shifts and earnings", logo: "/brand/spotly-driver.svg" });
  if ([...roles].some((role) => /staff|support|people|verification|operations|finance|content|manager|admin/.test(role))) items.push({ href: "/staff", label: "Staff", description: "Work, schedule, learning and pay", logo: "/brand/spotly-admin.svg" });
  if ([...roles].some((role) => /admin|super_admin|platform/.test(role))) items.push({ href: "/admin", label: "Admin", description: "Platform operations and review queues", logo: "/brand/spotly-admin.svg" });
  return items;
}

export function AccountApp() {
  const { user, profile, memberships, logout, linkProvider, beginPhoneLink, enablePushNotifications } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("+263");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState("");
  const [language, setLanguage] = useState("English");
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const providers = useMemo(() => new Set(user?.providerData?.map((item) => item.providerId) || []), [user]);
  const workspaces = useMemo(() => workspaceAccess(profile, memberships), [profile, memberships]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("spotly-account-preferences") || "{}");
      if (saved.language) setLanguage(saved.language);
      if (typeof saved.emailUpdates === "boolean") setEmailUpdates(saved.emailUpdates);
      if (typeof saved.orderUpdates === "boolean") setOrderUpdates(saved.orderUpdates);
    } catch {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem("spotly-account-preferences", JSON.stringify({ language, emailUpdates, orderUpdates }));
  }, [language, emailUpdates, orderUpdates]);

  async function link(provider) {
    setLoading(provider);
    try { await linkProvider(provider); toast(`${provider === "google.com" ? "Google" : "Apple"} linked.`, { title: "Account updated" }); }
    catch (error) { toast(error.message, { type: "error", title: "Could not link" }); }
    finally { setLoading(""); }
  }
  async function sendPhone() {
    setLoading("phone");
    try { const result = await beginPhoneLink(phone); setConfirmation(result); toast("Enter the verification code sent to your phone.", { title: "Code sent" }); }
    catch (error) { toast(error.message, { type: "error", title: "Could not send code" }); }
    finally { setLoading(""); }
  }
  async function confirmPhone() {
    setLoading("code");
    try { await confirmation.confirm(code); setConfirmation(null); toast("Your phone number is now linked.", { title: "Phone linked" }); }
    catch (error) { toast(error.message, { type: "error", title: "Invalid code" }); }
    finally { setLoading(""); }
  }
  async function push() {
    setLoading("push");
    try { await enablePushNotifications(); toast("This browser can now receive Spotly notifications.", { title: "Notifications enabled" }); }
    catch (error) { toast(error.message, { type: "error", title: "Notifications are not available" }); }
    finally { setLoading(""); }
  }

  const displayName = profile?.displayName || user?.displayName || "Your account";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AuthGate>
      <main className="min-h-screen bg-grouped text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}>
        <header className="border-b bg-white"><div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="" width={40} height={40} /><span className="text-lg font-semibold">Account</span></Link><Button variant="ghost" onClick={async () => { await logout(); window.location.href = "/"; }}><LogOut className="h-4 w-4" />Sign out</Button></div></header>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <section className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-center"><span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-violet-soft text-xl font-semibold text-violet">{user?.photoURL ? <Image src={user.photoURL} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-violet">Your account</p><h1 className="mt-1 truncate text-3xl font-semibold tracking-[-.035em]">{displayName}</h1><p className="mt-1 truncate text-sm text-secondary">{user?.email}</p></div><Button asChild variant="outline"><Link href="/support?topic=account">Get account help</Link></Button></section>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><UserRound className="h-5 w-5" /></span><div><h2 className="font-semibold">Profile and contact</h2><p className="mt-1 text-sm text-secondary">Details used for pickup and account support</p></div></div><div className="mt-5 divide-y rounded-xl border"><ListRow icon={Mail} title={user?.email || "No email"} subtitle={user?.emailVerified ? "Email verified" : "Email verification pending"} trailing={<StatusBadge status={user?.emailVerified ? "Verified" : "Pending"} />} /><ListRow icon={Phone} title={user?.phoneNumber || "No phone number linked"} subtitle={user?.phoneNumber ? "Available for account and pickup contact" : "Add a number for account recovery and pickup updates"} /></div>{!user?.phoneNumber && <div className="mt-4"><div id="spotly-recaptcha" />{confirmation ? <div className="flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit code" className="input min-w-0 flex-1" /><Button onClick={confirmPhone} loading={loading === "code"}>Confirm</Button></div> : <div className="flex gap-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+263…" className="input min-w-0 flex-1" /><Button onClick={sendPhone} loading={loading === "phone"}>Send code</Button></div>}<p className="mt-3 text-xs leading-5 text-tertiary">If phone verification is unavailable, contact support and continue using email.</p></div>}</Card>

            <Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><LockKeyhole className="h-5 w-5" /></span><div><h2 className="font-semibold">Sign-in and security</h2><p className="mt-1 text-sm text-secondary">Methods connected to this account</p></div></div><div className="mt-5 rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Email and password</p><p className="mt-1 text-xs text-secondary">Primary sign-in method</p></div><StatusBadge status="Active" /></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => link("google.com")} disabled={providers.has("google.com")} loading={loading === "google.com"}>{providers.has("google.com") ? <><Check className="h-4 w-4" />Google linked</> : "Link Google"}</Button><Button variant="outline" onClick={() => link("apple.com")} disabled={providers.has("apple.com")} loading={loading === "apple.com"}>{providers.has("apple.com") ? <><Check className="h-4 w-4" />Apple linked</> : "Link Apple"}</Button></div></Card>

            <Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><BellRing className="h-5 w-5" /></span><div><h2 className="font-semibold">Notifications</h2><p className="mt-1 text-sm text-secondary">Choose which useful updates you receive</p></div></div><div className="mt-5 space-y-3"><label className="flex items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-semibold">Order and pickup updates</span><span className="mt-1 block text-xs text-secondary">Status, payment and collection changes</span></span><input type="checkbox" checked={orderUpdates} onChange={(event) => setOrderUpdates(event.target.checked)} className="h-5 w-5 accent-violet" /></label><label className="flex items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-semibold">Launch and account email</span><span className="mt-1 block text-xs text-secondary">Important account and launch communication</span></span><input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} className="h-5 w-5 accent-violet" /></label><Button variant="outline" onClick={push} loading={loading === "push"} className="w-full">Enable browser notifications</Button></div></Card>

            <Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><Globe2 className="h-5 w-5" /></span><div><h2 className="font-semibold">Language and accessibility</h2><p className="mt-1 text-sm text-secondary">Preferences for this browser</p></div></div><label className="mt-5 block text-sm font-medium">Language<select value={language} onChange={(event) => setLanguage(event.target.value)} className="input mt-2 w-full"><option>English</option><option disabled>ChiShona — being prepared</option><option disabled>isiNdebele — being prepared</option></select></label><p className="mt-3 text-xs leading-5 text-secondary">Additional languages will appear after core customer and support journeys have been reviewed by fluent speakers.</p></Card>
          </div>

          <Card className="mt-5 p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><Store className="h-5 w-5" /></span><div><h2 className="font-semibold">Your workspaces</h2><p className="mt-1 text-sm text-secondary">Only workspaces assigned to this account are shown</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workspaces.map((workspace) => <Link key={workspace.href} href={workspace.href} className="flex items-center gap-3 rounded-xl border p-4 transition hover:border-violet/30 hover:bg-violet-soft/40"><Image src={workspace.logo} alt="" width={42} height={42} className="rounded-lg" /><span className="min-w-0"><span className="block font-semibold">{workspace.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{workspace.description}</span></span></Link>)}</div></Card>

          <Card className="mt-5 p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-semibold">Privacy and data</h2><p className="mt-1 text-sm text-secondary">Get help with account information or a data request</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button asChild variant="outline"><Link href="/support?topic=privacy">Request my data</Link></Button><Button asChild variant="outline"><Link href="/support?topic=account-delete">Close my account</Link></Button></div></Card>
        </div>
      </main>
    </AuthGate>
  );
}
