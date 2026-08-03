"use client";

import Image from "next/image";
import Link from "next/link";
import { BellRing, Check, Link2, LogOut, Mail, Phone, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Button, Card, StatusBadge } from "@/components/ui";

export function AccountApp() {
  const { user, profile, memberships, logout, linkProvider, beginPhoneLink, enablePushNotifications } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("+263");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState("");
  const providers = useMemo(() => new Set(user?.providerData?.map((item) => item.providerId) || []), [user]);

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
    try { await enablePushNotifications(); toast("This browser can now receive Spotly push notifications.", { title: "Notifications enabled" }); }
    catch (error) { toast(error.message, { type: "error", title: "Could not enable notifications" }); }
    finally { setLoading(""); }
  }

  return <AuthGate><main className="min-h-screen bg-grouped text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><header className="border-b bg-white"><div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={42} height={42} className="rounded-[14px]" /><span className="font-black">Spotly account</span></Link><Button variant="ghost" onClick={async () => { await logout(); window.location.href = "/"; }}><LogOut className="h-4 w-4" />Sign out</Button></div></header><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-violet-soft text-xl font-black text-violet">{user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (user?.displayName || user?.email || "S").slice(0, 2).toUpperCase()}</span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet">Shared Spotly identity</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">{profile?.displayName || user?.displayName || "Your account"}</h1><p className="mt-1 text-sm text-secondary">{user?.email}</p></div></div><div className="mt-7 grid gap-5 lg:grid-cols-2"><Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold">Primary credential</h2><p className="mt-1 text-sm text-secondary">Email and password remain required</p></div></div><div className="mt-5 flex items-center justify-between rounded-xl bg-grouped p-4"><div className="flex items-center gap-3"><Mail className="h-5 w-5 text-tertiary" /><div><p className="text-sm font-semibold">{user?.email}</p><p className="mt-1 text-xs text-secondary">{user?.emailVerified ? "Email verified" : "Verification pending"}</p></div></div><StatusBadge status={user?.emailVerified ? "Verified" : "Pending"} /></div></Card><Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet"><Link2 className="h-5 w-5" /></span><div><h2 className="font-bold">Linked sign-in methods</h2><p className="mt-1 text-sm text-secondary">Use them without creating another account</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => link("google.com")} disabled={providers.has("google.com")} loading={loading === "google.com"}>{providers.has("google.com") ? <><Check className="h-4 w-4" />Google linked</> : "Link Google"}</Button><Button variant="outline" onClick={() => link("apple.com")} disabled={providers.has("apple.com")} loading={loading === "apple.com"}>{providers.has("apple.com") ? <><Check className="h-4 w-4" />Apple linked</> : "Link Apple"}</Button></div></Card><Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet"><Phone className="h-5 w-5" /></span><div><h2 className="font-bold">Phone number</h2><p className="mt-1 text-sm text-secondary">Link for sign-in and account recovery support</p></div></div>{user?.phoneNumber ? <div className="mt-5 flex items-center justify-between rounded-xl bg-grouped p-4"><span className="font-semibold">{user.phoneNumber}</span><StatusBadge status="Linked" /></div> : <div className="mt-5"><div id="spotly-recaptcha" />{confirmation ? <div className="flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit code" className="surface h-11 min-w-0 flex-1 rounded-xl px-3 outline-none" /><Button onClick={confirmPhone} loading={loading === "code"}>Confirm</Button></div> : <div className="flex gap-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+263…" className="surface h-11 min-w-0 flex-1 rounded-xl px-3 outline-none" /><Button onClick={sendPhone} loading={loading === "phone"}>Send code</Button></div>}<p className="mt-3 text-xs leading-5 text-tertiary">Phone Authentication must be enabled and the deployment domain authorized in Firebase Console.</p></div>}</Card><Card className="p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet"><BellRing className="h-5 w-5" /></span><div><h2 className="font-bold">Browser notifications</h2><p className="mt-1 text-sm text-secondary">Pickup, claims, support, and account alerts</p></div></div><Button variant="outline" onClick={push} loading={loading === "push"} className="mt-5 w-full">Enable on this browser</Button><p className="mt-3 text-xs leading-5 text-tertiary">Requires a Firebase Web Push certificate VAPID key in the deployment environment.</p></Card></div><Card className="mt-5 p-6"><h2 className="font-bold">Portal access</h2><p className="mt-2 text-sm leading-6 text-secondary">Access comes from your user roles and organization memberships. One user can belong to multiple businesses and branches.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Link href="/marketplace"><Button variant="outline" className="w-full">Customer preview</Button></Link><Link href="/business"><Button variant="outline" className="w-full">Business portal</Button></Link><Link href="/admin"><Button variant="outline" className="w-full">Admin portal</Button></Link></div>{memberships.length > 0 && <div className="mt-5 border-t pt-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">Active memberships</p><div className="mt-3 space-y-2">{memberships.map((membership) => <div key={membership.id} className="flex items-center justify-between rounded-xl bg-grouped p-3 text-sm"><span>{membership.organizationId || membership.businessId}</span><span className="font-semibold capitalize">{membership.role}</span></div>)}</div></div>}</Card></div></main></AuthGate>;
}
