"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BellRing, Check, Globe2, Heart, HelpCircle, History, LockKeyhole, LogOut, Mail, MapPin, Pencil, Phone, Plus, ShieldCheck, Store, Trash2, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Button, Card, ListRow, Modal, StatusBadge } from "@/components/ui";
import { deleteSavedItem, saveSavedItem, saveUserPreferences, saveUserProfileDetails, subscribeSavedItems } from "@/lib/firebase-services";
import { workspaceAccess as resolveWorkspaceAccess } from "@/lib/workspaces";
import { BUILD_INFO, buildLabel } from "@/lib/build-info";
import { NotificationCenter } from "@/components/notification-center";
import { SpotlyLottie } from "@/components/spotly-lottie";
import { spotlyPortalUrl } from "@/lib/spotly-domains";
import { CustomerShell } from "@/components/customer-shell";
import { cn } from "@/lib/cn";

function accountWorkspaces(profile, memberships, staffProfile, driverProfile, driverApplication) {
  const access = resolveWorkspaceAccess({ profile, memberships, staffProfile, driverProfile: driverProfile || driverApplication });
  const definitions = [
    { id: "customer", href: spotlyPortalUrl("customer", "/marketplace"), label: "Customer", description: "Shop nearby, manage orders, delivery, pickup and saved businesses", logo: "/brand/spotly.svg", lottie: "marketplace-discover" },
    { id: "business", href: spotlyPortalUrl("business"), label: "Business", description: "Operate assigned businesses and locations", logo: "/brand/spotly-business.svg", lottie: "storefront-open" },
    { id: "driver", href: spotlyPortalUrl("driver"), label: "Driver", description: "Application, live deliveries, earnings and Driver account", logo: "/brand/spotly-driver.svg", lottie: "driver-online" },
    { id: "staff", href: spotlyPortalUrl("staff"), label: "Staff", description: "Work, schedule, learning and pay", logo: "/brand/spotly-staff.svg", lottie: "verified-business" },
    { id: "admin", href: spotlyPortalUrl("admin"), label: "Admin", description: "Platform operations and review queues", logo: "/brand/spotly-admin.svg", lottie: "notification-bell" }
  ];
  return definitions.filter((item) => access.has(item.id));
}


function AccountSection({ id, icon: Icon, title, description, children, action }) {
  return <section id={id} className="scroll-mt-28 border-b border-[var(--border-subtle)] py-7 first:pt-0 last:border-0">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold tracking-[-.025em]">{title}</h2>{description ? <p className="mt-1 max-w-xl text-sm leading-6 text-secondary">{description}</p> : null}</div></div>{action}</div>
    <div className="mt-5">{children}</div>
  </section>;
}

function ToggleRow({ title, description, checked, onChange }) {
  return <label className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-3 last:border-0"><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-secondary">{description}</span></span><span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]")}><input type="checkbox" checked={checked} onChange={onChange} className="sr-only" /><span className={cn("absolute top-1 h-5 w-5 rounded-full bg-[var(--surface)] shadow-sm transition", checked ? "left-6" : "left-1")} /></span></label>;
}

function ChoiceGroup({ value, onChange, options, label }) {
  return <div><p className="text-sm font-semibold">{label}</p><div className="mt-2 flex flex-wrap gap-2">{options.map((option) => { const active = value === option.value; return <button key={option.value} type="button" disabled={option.disabled} onClick={() => onChange(option.value)} className={cn("inline-flex min-h-10 items-center gap-2 rounded-[12px] border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45", active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]")}>{active ? <Check className="h-4 w-4" /> : null}{option.label}</button>; })}</div></div>;
}

export function AccountApp() {
  const { user, profile, memberships, staffProfile, driverProfile, driverApplication, logout, linkProvider, beginPhoneLink, enablePushNotifications, resetPassword } = useAuth();
  const { settings } = usePlatform();
  const { toast } = useToast();
  const [phone, setPhone] = useState("+263");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState("");
  const [language, setLanguage] = useState("English");
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [businessUpdates, setBusinessUpdates] = useState(true);
  const [workUpdates, setWorkUpdates] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [defaultFulfilment, setDefaultFulfilment] = useState("pickup");
  const [profileOpen, setProfileOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [placeForm, setPlaceForm] = useState({ label: "Home", address: "", area: "", city: "Harare" });
  const [profileForm, setProfileForm] = useState({ displayName: "", phone: "", preferredContact: "email", pickupContactName: "", pickupContactPhone: "" });
  const providers = useMemo(() => new Set(user?.providerData?.map((item) => item.providerId) || []), [user]);
  const workspaces = useMemo(() => accountWorkspaces(profile, memberships, staffProfile, driverProfile, driverApplication), [profile, memberships, staffProfile, driverProfile, driverApplication]);

  useEffect(() => {
    const preferences = profile?.preferences || {};
    setLanguage(preferences.language || "English");
    setEmailUpdates(preferences.emailUpdates !== false);
    setOrderUpdates(preferences.orderUpdates !== false);
    setBusinessUpdates(preferences.businessUpdates !== false);
    setWorkUpdates(preferences.workUpdates !== false);
    setMarketing(Boolean(preferences.marketing));
    setPreferredCurrency(preferences.preferredCurrency || "USD");
    setDefaultFulfilment(preferences.defaultFulfilment || "pickup");
    setProfileForm({
      displayName: profile?.displayName || user?.displayName || "",
      phone: profile?.phone || user?.phoneNumber || "",
      preferredContact: profile?.preferredContact || "email",
      pickupContactName: profile?.pickupContactName || profile?.displayName || user?.displayName || "",
      pickupContactPhone: profile?.pickupContactPhone || profile?.phone || user?.phoneNumber || ""
    });
  }, [profile, user?.displayName, user?.phoneNumber]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return undefined;
    return subscribeSavedItems(user.uid, (items) => setSavedPlaces(items.filter((item) => item.type === "place")), () => {});
  }, [user?.uid, user?.isAnonymous]);

  async function savePlace(event) {
    event.preventDefault();
    if (!placeForm.label.trim() || !placeForm.address.trim()) return;
    setLoading("place");
    try {
      const entityId = `${placeForm.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
      await saveSavedItem(user.uid, { type: "place", entityId, title: placeForm.label.trim(), subtitle: [placeForm.area, placeForm.city].filter(Boolean).join(" · "), address: placeForm.address.trim(), area: placeForm.area.trim(), city: placeForm.city.trim() || "Harare", href: "/?view=saved" });
      setPlaceForm({ label: "Home", address: "", area: "", city: "Harare" });
      setPlaceOpen(false);
      toast("Place saved to your account.", { title: "Saved place" });
    } catch (error) { toast(error.message, { type: "error", title: "Could not save place" }); }
    finally { setLoading(""); }
  }

  async function removePlace(item) {
    try { await deleteSavedItem(user.uid, "place", item.entityId); }
    catch (error) { toast(error.message, { type: "error", title: "Could not remove place" }); }
  }

  async function savePreferences() {
    setLoading("preferences");
    try {
      await saveUserPreferences(user.uid, { language, emailUpdates, orderUpdates, businessUpdates, workUpdates, marketing, preferredCurrency, defaultFulfilment }, user);
      toast("Your notification and language preferences were saved to your account.", { title: "Preferences saved" });
    } catch (error) { toast(error.message, { type: "error", title: "Could not save preferences" }); }
    finally { setLoading(""); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setLoading("profile");
    try {
      await saveUserProfileDetails(user.uid, profileForm, user);
      toast("Your profile and pickup contact were updated.", { title: "Profile saved" });
      setProfileOpen(false);
    } catch (error) { toast(error.message, { type: "error", title: "Could not save profile" }); }
    finally { setLoading(""); }
  }

  async function sendPasswordReset() {
    setLoading("password");
    try { await resetPassword(user.email); toast("A password reset link was sent to your email.", { title: "Check your email" }); }
    catch (error) { toast(error.message, { type: "error", title: "Could not send reset link" }); }
    finally { setLoading(""); }
  }


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
  const legal = settings?.legal || {};
  const companyRegistered = Boolean(String(legal.legalName || "").trim() && String(legal.companyNumber || "").trim());
  const customerWorkspace = workspaces.find((workspace) => workspace.id === "customer");
  const roleWorkspaces = workspaces.filter((workspace) => workspace.id !== "customer");

  return (
    <AuthGate>
      <CustomerShell current="profile" user={user} profile={profile} locationLabel={profile?.preferences?.preferredCity || settings.launch?.primaryCity || "Harare"}>
        <div className="v7-page-enter mx-auto max-w-[1120px]">
          <section className="flex flex-col gap-5 border-b border-[var(--border-subtle)] pb-7 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[16px] bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)]">{user?.photoURL ? <Image src={user.photoURL} alt="" width={64} height={64} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--accent)]">Profile</p><h1 className="mt-1 truncate text-[34px] font-semibold tracking-[-.05em] sm:text-[42px]">{displayName}</h1><p className="mt-1 truncate text-sm text-secondary">{user?.email}</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setProfileOpen(true)}><Pencil className="h-4 w-4" />Edit profile</Button><Button variant="ghost" onClick={async () => { await logout(); window.location.href = "/"; }}><LogOut className="h-4 w-4" />Sign out</Button></div>
          </section>

          <div className="mt-7 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden lg:block"><nav className="sticky top-28 space-y-1 text-sm font-semibold" aria-label="Account sections">{[
              ["profile", "Profile", UserRound], ["places", "Places", MapPin], ["preferences", "Preferences", Store], ["notifications", "Notifications", BellRing], ["security", "Privacy & security", ShieldCheck], ["workspaces", "Workspaces", Globe2], ["help", "Help", HelpCircle]
            ].map(([id,label,Icon]) => <a key={id} href={`#${id}`} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[var(--text-2)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><Icon className="h-4 w-4" />{label}</a>)}</nav></aside>

            <div className="min-w-0">
              <AccountSection id="profile" icon={UserRound} title="Profile and contact" description="The details Spotly uses for your account, pickup and support." action={<Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}><Pencil className="h-4 w-4" />Edit</Button>}>
                <div className="divide-y divide-[var(--border-subtle)] rounded-[16px] border border-[var(--border-subtle)] px-4"><ListRow icon={Mail} title={user?.email || "No email"} subtitle={user?.emailVerified ? "Email verified" : "Email verification pending"} trailing={<StatusBadge status={user?.emailVerified ? "verified" : "pending"} />} /><ListRow icon={Phone} title={profile?.phone || user?.phoneNumber || "No phone linked"} subtitle="Used only where a service needs a contact number" /></div>
              </AccountSection>

              <AccountSection id="places" icon={MapPin} title="Saved places" description="Home, Work and addresses you use often become shortcuts for Search, Ride and Send." action={<Button size="sm" variant="outline" onClick={() => setPlaceOpen(true)}><Plus className="h-4 w-4" />Add place</Button>}>
                {savedPlaces.length ? <div className="divide-y divide-[var(--border-subtle)]">{savedPlaces.map((place) => <div key={place.id} className="flex items-center gap-3 py-3.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[var(--accent)]"><MapPin className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{place.title}</p><p className="mt-1 truncate text-xs text-secondary">{place.address}{place.area || place.city ? ` · ${[place.area, place.city].filter(Boolean).join(", ")}` : ""}</p></div><button type="button" onClick={() => removePlace(place)} className="flex h-10 w-10 items-center justify-center rounded-[12px] text-tertiary hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]" aria-label={`Remove ${place.title}`}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="rounded-[16px] bg-[var(--surface-2)] p-5"><MapPin className="h-5 w-5 text-[var(--accent)]" /><h3 className="mt-3 font-semibold">No saved places yet</h3><p className="mt-1 text-sm leading-6 text-secondary">Add Home or Work now, or save a place naturally after a Ride or Send later.</p><Button size="sm" className="mt-4" variant="outline" onClick={() => setPlaceOpen(true)}>Add a place</Button></div>}
              </AccountSection>

              <AccountSection id="preferences" icon={Store} title="Preferences" description="These defaults make Spotly faster without limiting what each business can offer.">
                <div className="space-y-6"><ChoiceGroup label="Currency & region" value={preferredCurrency} onChange={setPreferredCurrency} options={(settings.commerce?.currencies || ["USD", "ZWG"]).map((item) => ({ value: item, label: item === "ZWG" ? "ZiG" : item }))} /><ChoiceGroup label="Default fulfilment" value={defaultFulfilment} onChange={setDefaultFulfilment} options={[{ value: "pickup", label: "Pickup" }, { value: "delivery", label: "Delivery when available" }]} /><ChoiceGroup label="Language" value={language} onChange={setLanguage} options={[{ value: "English", label: "English" }, { value: "ChiShona", label: "ChiShona · coming", disabled: true }, { value: "isiNdebele", label: "isiNdebele · coming", disabled: true }]} /><div className="flex justify-end"><Button onClick={savePreferences} loading={loading === "preferences"}>Save preferences</Button></div></div>
              </AccountSection>

              <AccountSection id="notifications" icon={BellRing} title="Notifications" description="Choose which updates deserve your attention.">
                <div><ToggleRow title="Order and pickup updates" description="Status, payment and collection changes" checked={orderUpdates} onChange={(event) => setOrderUpdates(event.target.checked)} /><ToggleRow title="Account email" description="Important account and launch communication" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} /><ToggleRow title="Business updates" description="Business setup, claims and operational changes" checked={businessUpdates} onChange={(event) => setBusinessUpdates(event.target.checked)} /><ToggleRow title="Staff and work updates" description="Tasks, shifts, learning and approvals" checked={workUpdates} onChange={(event) => setWorkUpdates(event.target.checked)} /><ToggleRow title="Marketing" description="Optional Spotly launch and product news" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={push} loading={loading === "push"}>Enable browser notifications</Button><Button asChild variant="outline"><Link href="/notifications">Open notification center</Link></Button><Button onClick={savePreferences} loading={loading === "preferences"}>Save notification choices</Button></div>
                <div className="mt-7"><NotificationCenter workspace="customer" customerMode title="Your notification history" description="Orders, bookings, support and important account updates." /></div>
              </AccountSection>

              <AccountSection id="security" icon={ShieldCheck} title="Privacy & security" description="Sign-in methods, account sessions and your data controls.">
                <div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => link("google.com")} loading={loading === "google.com"}>{providers.has("google.com") ? <><Check className="h-4 w-4" />Google linked</> : "Link Google"}</Button><Button variant="outline" onClick={() => link("apple.com")} loading={loading === "apple.com"}>{providers.has("apple.com") ? <><Check className="h-4 w-4" />Apple linked</> : "Link Apple"}</Button><Button variant="outline" onClick={sendPasswordReset} loading={loading === "password"}>Change password</Button><Button asChild variant="outline"><Link href="/support?topic=security-sessions">Review account sessions</Link></Button></div>
                {!user?.phoneNumber ? <div className="mt-5 rounded-[16px] bg-[var(--surface-2)] p-4"><p className="text-sm font-semibold">Add a phone number</p><p className="mt-1 text-xs leading-5 text-secondary">Useful for account recovery and services that need a contact number.</p>{confirmation ? <div className="mt-3 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value)} className="field-control" placeholder="Verification code" /><Button onClick={confirmPhone} loading={loading === "code"}>Confirm</Button></div> : <div className="mt-3 flex gap-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} className="field-control" placeholder="+263…" /><Button onClick={sendPhone} loading={loading === "phone"}>Send code</Button></div>}</div> : null}
                <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button asChild variant="outline"><Link href="/support?topic=privacy">Request my data</Link></Button><Button asChild variant="outline"><Link href="/support?topic=account-delete">Close my account</Link></Button></div>
              </AccountSection>

              <AccountSection id="workspaces" icon={Globe2} title="Where do you want to go?" description="Customer is always available. Business, Driver, Staff and Admin appear only when this account has access.">
                {customerWorkspace ? <Link href={customerWorkspace.href} className="group flex items-center gap-4 rounded-[16px] border border-[var(--border-subtle)] p-4 transition hover:bg-[var(--surface-hover)]"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[var(--accent-soft)]"><Image src={customerWorkspace.logo} alt="" width={46} height={46} className="h-12 w-12 object-contain" /></span><span className="min-w-0 flex-1"><span className="font-semibold">Customer</span><span className="mt-1 block text-xs leading-5 text-secondary">{customerWorkspace.description}</span></span><ArrowRight className="h-4 w-4 text-tertiary transition group-hover:translate-x-0.5" /></Link> : null}
                {roleWorkspaces.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{roleWorkspaces.map((workspace) => <Link key={workspace.id} href={workspace.href} className="group flex items-center gap-3 rounded-[16px] border border-[var(--border-subtle)] p-3.5 transition hover:bg-[var(--surface-hover)]"><span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--surface-2)]"><Image src={workspace.logo} alt="" width={38} height={38} className="h-10 w-10 object-contain" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{workspace.label}</span><span className="mt-0.5 block truncate text-xs text-secondary">{workspace.description}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : null}
              </AccountSection>

              <AccountSection id="help" icon={HelpCircle} title="Help" description="Get support without losing the context of what you were trying to do.">
                <div className="grid gap-3 sm:grid-cols-3"><Link href="/?view=activity" className="rounded-[16px] border border-[var(--border-subtle)] p-4 transition hover:bg-[var(--surface-hover)]"><History className="h-5 w-5 text-[var(--accent)]" /><span className="mt-3 block text-sm font-semibold">Activity</span><span className="mt-1 block text-xs text-secondary">Orders, bookings and trips</span></Link><Link href="/?view=saved" className="rounded-[16px] border border-[var(--border-subtle)] p-4 transition hover:bg-[var(--surface-hover)]"><Heart className="h-5 w-5 text-[var(--accent)]" /><span className="mt-3 block text-sm font-semibold">Saved</span><span className="mt-1 block text-xs text-secondary">Things you kept</span></Link><Link href="/support" className="rounded-[16px] border border-[var(--border-subtle)] p-4 transition hover:bg-[var(--surface-hover)]"><HelpCircle className="h-5 w-5 text-[var(--accent)]" /><span className="mt-3 block text-sm font-semibold">Spotly Support</span><span className="mt-1 block text-xs text-secondary">Guides and conversations</span></Link></div>
                {companyRegistered ? <p className="mt-5 text-xs leading-5 text-secondary">{legal.tradingName || "Spotly"} is operated by <strong>{legal.legalName}</strong>. Company registration number: <strong>{legal.companyNumber}</strong>{legal.registeredAddress ? ` · ${legal.registeredAddress}` : ""}.</p> : null}
              </AccountSection>

              <p className="mt-6 text-center text-xs text-tertiary">{buildLabel()} · {BUILD_INFO.environment}</p>
            </div>
          </div>
        </div>

        <Modal open={placeOpen} onClose={() => setPlaceOpen(false)} title="Add a saved place" description="Save an address you use often. You can remove it at any time."><form onSubmit={savePlace} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Label</span><input required value={placeForm.label} onChange={(event) => setPlaceForm({ ...placeForm, label: event.target.value })} className="field-control w-full" placeholder="Home" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Address or landmark</span><input required value={placeForm.address} onChange={(event) => setPlaceForm({ ...placeForm, address: event.target.value })} className="field-control w-full" placeholder="Street, building or landmark" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Area</span><input value={placeForm.area} onChange={(event) => setPlaceForm({ ...placeForm, area: event.target.value })} className="field-control w-full" placeholder="Avondale" /></label><label><span className="mb-2 block text-sm font-semibold">City</span><input required value={placeForm.city} onChange={(event) => setPlaceForm({ ...placeForm, city: event.target.value })} className="field-control w-full" /></label></div><Button type="submit" className="w-full" loading={loading === "place"}>Save place</Button></form></Modal>
        <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Edit profile and pickup contact" description="These details are saved to your Spotly account and used only where relevant."><form onSubmit={saveProfile} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Display name</span><input required value={profileForm.displayName} onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })} className="field-control w-full" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Contact phone</span><input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} className="field-control w-full" placeholder="+263…" /></label><ChoiceGroup label="Preferred contact" value={profileForm.preferredContact} onChange={(value) => setProfileForm({ ...profileForm, preferredContact: value })} options={[{ value: "email", label: "Email" }, { value: "phone", label: "Phone" }, { value: "whatsapp", label: "WhatsApp" }]} /><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Pickup contact name</span><input value={profileForm.pickupContactName} onChange={(event) => setProfileForm({ ...profileForm, pickupContactName: event.target.value })} className="field-control w-full" /></label><label><span className="mb-2 block text-sm font-semibold">Pickup contact phone</span><input value={profileForm.pickupContactPhone} onChange={(event) => setProfileForm({ ...profileForm, pickupContactPhone: event.target.value })} className="field-control w-full" /></label></div><Button type="submit" className="w-full" loading={loading === "profile"}>Save profile</Button></form></Modal>
      </CustomerShell>
    </AuthGate>
  );
}
