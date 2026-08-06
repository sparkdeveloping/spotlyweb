"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, Building2, CheckCircle2, Eye, FileCheck2, ImagePlus, Languages, Save, ShieldCheck, UploadCloud } from "lucide-react";
import { Badge, Button, Card, PageHeader, SectionCard, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, EntityStatus, FieldLabel, FullScreenTask, ReadinessCard, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";
import { businessCategories, defaultOperationalSettings, getBusinessReadiness } from "@/data/business-config";
import { saveBusinessProfile, uploadFile } from "@/lib/firebase-services";
import { requestBusinessPublicationReview, saveBusinessOperationalSettings } from "@/lib/business-services";

const profileDefaults = {
  name: "", legalName: "", category: "Groceries", categories: ["Groceries"], description: "", phone: "", whatsapp: "", email: "", website: "", instagram: "", facebook: "", logo: "", coverImage: "", public: false, preferredLocale: "en", customerNotes: ""
};

function UploadField({ label, value, path, onChange, user }) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose a JPG, PNG, or WebP image.", { type: "error", title: "Image required" });
    if (file.size > 8 * 1024 * 1024) return toast("Use an image smaller than 8 MB.", { type: "error", title: "Image too large" });
    setUploading(true);
    try {
      const result = await uploadFile(`${path}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`, file, { uploadedBy: user.uid });
      onChange(result.url || result);
      toast("The image is uploaded. Save this page when the preview looks right.", { title: "Upload complete" });
    } catch (error) {
      toast(error.message || "The image could not be uploaded.", { type: "error", title: "Upload failed" });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  return <div><p className="mb-2 text-sm font-semibold">{label}</p><div className="flex items-center gap-4 rounded-2xl border p-4">{value ? <Image src={value} alt="" width={68} height={68} unoptimized className="h-16 w-16 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-grouped text-tertiary"><ImagePlus className="h-6 w-6" /></span>}<div className="min-w-0 flex-1"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-sm font-semibold hover:bg-grouped"><UploadCloud className="h-4 w-4" />{uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} disabled={uploading} /></label><p className="mt-2 text-xs leading-5 text-secondary">JPG, PNG, or WebP · up to 8 MB.</p></div></div></div>;
}

function operationsCopy(archetype) {
  if (archetype.id === "ticketing_events") return { title: "Ticket and check-in defaults", description: "Set how sales are confirmed, tickets are issued, and guests are checked in.", instructionLabel: "Guest instructions", instructionPlaceholder: "Explain entry, ticket presentation, age restrictions, and arrival time.", autoLabel: "Automatically confirm paid ticket sales", minimumLabel: "Minimum transaction", cancellation: ["before_event", "business_review", "not_allowed"] };
  if (archetype.id === "appointments_services") return { title: "Appointment defaults", description: "Set confirmation, lead time, customer arrival, and cancellation expectations.", instructionLabel: "Appointment instructions", instructionPlaceholder: "Explain preparation, arrival time, and anything customers should bring.", autoLabel: "Automatically confirm available appointments", minimumLabel: "Minimum booking value", cancellation: ["before_service", "business_review", "not_allowed"] };
  if (archetype.id === "accommodation_activities") return { title: "Booking defaults", description: "Set confirmation, check-in, customer instructions, and cancellation expectations.", instructionLabel: "Check-in or arrival instructions", instructionPlaceholder: "Explain arrival, check-in, access, and what guests should bring.", autoLabel: "Automatically confirm available bookings", minimumLabel: "Minimum booking value", cancellation: ["before_checkin", "business_review", "not_allowed"] };
  if (archetype.id === "directory_profile") return { title: "Enquiry defaults", description: "Set how customer enquiries are acknowledged and routed to the right person.", instructionLabel: "Customer contact guidance", instructionPlaceholder: "Explain the best way and time for customers to contact the business.", autoLabel: "Automatically acknowledge new enquiries", minimumLabel: "Minimum value", cancellation: ["business_review"] };
  return { title: archetype.id === "restaurant_food" ? "Food collection defaults" : "Pickup defaults", description: "Set the starting rules for collection. Each location can override them when necessary.", instructionLabel: "Customer collection instructions", instructionPlaceholder: "Explain where customers collect, what they bring, and how handover works.", autoLabel: "Automatically accept available orders", minimumLabel: "Minimum order", cancellation: ["before_preparation", "before_acceptance", "business_review", "not_allowed"] };
}

export function SettingsView() {
  const workspace = useBusinessWorkspace();
  const { business, operations, branches, user, archetype, setupComplete } = workspace;
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(profileDefaults);
  const [ops, setOps] = useState(defaultOperationalSettings);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [task, setTask] = useState({ open: false, state: "processing", title: "", description: "", active: 0 });
  const { toast } = useToast();
  const operationText = operationsCopy(archetype);
  const hasPickup = archetype.capabilities.includes("pickup_orders");
  const hasInventory = archetype.capabilities.includes("inventory");
  const locationWord = archetype.nouns.branch === "venue" ? "venue" : archetype.nouns.branch === "property" ? "property" : "location";
  const activityWord = archetype.nouns.activity;

  useEffect(() => setProfile({ ...profileDefaults, ...(business || {}), categories: business?.categories?.length ? business.categories : [business?.category || "Other"] }), [business]);
  useEffect(() => setOps({ ...defaultOperationalSettings, ...(operations || {}) }), [operations]);
  const readiness = useMemo(() => getBusinessReadiness(workspace), [workspace]);

  function runTask(title, description) {
    setTask({ open: true, state: "processing", title, description, active: 1 });
  }

  async function saveProfile() {
    if (!profile.name.trim() || !profile.description.trim() || (!profile.phone.trim() && !profile.email.trim())) return toast("Add the business name, description, and at least one central contact method.", { type: "error", title: "Required details missing" });
    setSaving(true);
    runTask("Saving the business profile", "Spotly is updating the brand record, public listing, and customer contact details.");
    try {
      await saveBusinessProfile(business.id, {
        name: profile.name.trim(), legalName: profile.legalName, category: profile.category, categories: profile.categories, description: profile.description, phone: profile.phone, whatsapp: profile.whatsapp, email: profile.email, website: profile.website, instagram: profile.instagram, facebook: profile.facebook, logo: profile.logo, coverImage: profile.coverImage, public: Boolean(profile.public), preferredLocale: profile.preferredLocale, customerNotes: profile.customerNotes
      }, user);
      setTask({ open: true, state: "success", title: "Business profile saved", description: "The brand information is now consistent across the business workspace and public listing.", active: 4 });
    } catch (error) {
      setTask({ open: true, state: "error", title: "The profile was not saved", description: error.message || "Review the details and try again.", active: 1 });
    } finally { setSaving(false); }
  }

  async function saveOperations() {
    setSaving(true);
    runTask("Saving how the business operates", `Spotly is updating defaults for ${activityWord}, customer instructions, and team notifications.`);
    try {
      await saveBusinessOperationalSettings(business.id, ops, user);
      setTask({ open: true, state: "success", title: "Operating defaults saved", description: `The workspace now follows these defaults. Individual ${locationWord}s can still override them where needed.`, active: 4 });
    } catch (error) {
      setTask({ open: true, state: "error", title: "The settings were not saved", description: error.message || "Review the details and try again.", active: 1 });
    } finally { setSaving(false); }
  }

  async function requestReview() {
    if (readiness.percent < 100) return toast("Complete every required launch item before requesting publication review.", { type: "error", title: "Setup is not complete" });
    setReviewing(true);
    runTask("Sending the publication request", "Spotly is recording your readiness, verification state, and business details for administrator review.");
    try {
      await requestBusinessPublicationReview(business, user);
      setTask({ open: true, state: "success", title: "Review requested", description: "Spotly Admin can now review the business for accuracy and public visibility.", active: 4 });
    } catch (error) {
      setTask({ open: true, state: "error", title: "The request was not sent", description: error.message || "Try again or contact Spotly Support.", active: 1 });
    } finally { setReviewing(false); }
  }

  function toggleCategory(category) {
    setProfile((current) => ({ ...current, categories: current.categories.includes(category) ? current.categories.filter((item) => item !== category) : [...current.categories, category], category: current.categories.includes(category) && current.category === category ? "Other" : current.category }));
  }

  if (!setupComplete) return <div className="space-y-6"><PageHeader title="Account & access" description="Keep this area simple until Spotly knows what kind of business workspace to prepare." actions={<BusinessSwitcher />} /><Card className="overflow-hidden"><div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]"><div className="p-7 sm:p-10"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-business-soft text-business"><Building2 className="h-7 w-7" /></span><p className="mt-6 text-xs font-black uppercase tracking-[.16em] text-business">One recommended next step</p><h1 className="mt-2 text-3xl font-black tracking-tight">Finish the guided business setup</h1><p className="mt-4 max-w-xl text-sm leading-7 text-secondary">First confirm the business brand, exact location, and what customers should be able to do. Spotly will then reveal only the tools that fit this business.</p><Button href="/business/setup" className="mt-7">Continue guided setup<ArrowRight className="h-4 w-4" /></Button></div><div className="border-t bg-grouped/70 p-7 lg:border-l lg:border-t-0"><h2 className="font-bold">Available now</h2><div className="mt-5 space-y-3"><Button href="/account" variant="outline" className="w-full justify-start">Manage sign-in and linked accounts</Button><Button href="/business/support" variant="outline" className="w-full justify-start">Get help from Spotly Support</Button></div><p className="mt-5 text-xs leading-5 text-secondary">Finance, catalogue, locations, and operational controls stay out of the way until the guided setup confirms they are relevant.</p></div></div></Card></div>;

  const tabs = [
    { value: "profile", label: "Business profile" },
    { value: "brand", label: "Logo & media" },
    { value: "operations", label: "How it operates" },
    { value: "notifications", label: "Notifications" },
    { value: "publication", label: "Go live" }
  ];

  const notificationOptions = [
    { id: "orderNotifications", label: `New and changed ${activityWord}`, detail: `Creation, cancellation, payment, schedule, and status changes for ${activityWord}.` },
    ...(hasInventory ? [{ id: "lowStockNotifications", label: `Availability changes for ${archetype.nouns.items}`, detail: `Prompt the team before customers select an unavailable ${archetype.nouns.item}.` }] : []),
    { id: "supportNotifications", label: "Support replies", detail: "Notify the business when Spotly Support responds." },
    { id: "dailySummary", label: "Daily business summary", detail: `A concise summary of ${activityWord}, customer value, availability, and the next setup action.` }
  ];

  return <div className="space-y-6">
    <PageHeader title="Business settings" description="The brand is managed here. Exact addresses, opening hours, and local operations belong to each location." actions={<BusinessSwitcher />} />
    <Tabs value={tab} onChange={setTab} tabs={tabs} />

    {tab === "profile" && <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><SectionCard title="Brand-level information" description={`These details describe the whole business. Manage addresses and hours separately for each ${locationWord}.`}><div className="space-y-6 p-5"><div className="rounded-2xl bg-business-soft p-4 text-sm leading-6 text-business"><strong>{business.name}</strong> is the business brand. {branches.length ? `${branches.length} ${locationWord}${branches.length === 1 ? "" : "s"} currently belong to it.` : `Add its first ${locationWord} in guided setup.`}</div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Trading name" required><input className={fieldClass} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></FieldLabel><FieldLabel label="Legal name"><input className={fieldClass} value={profile.legalName} onChange={(event) => setProfile({ ...profile, legalName: event.target.value })} /></FieldLabel><FieldLabel label="Primary category"><select className={selectClass} value={profile.category} onChange={(event) => setProfile({ ...profile, category: event.target.value, categories: profile.categories.includes(event.target.value) ? profile.categories : [...profile.categories, event.target.value] })}>{businessCategories.map((item) => <option key={item}>{item}</option>)}</select></FieldLabel><FieldLabel label="Preferred content language"><select className={selectClass} value={profile.preferredLocale} onChange={(event) => setProfile({ ...profile, preferredLocale: event.target.value })}><option value="en">English</option><option value="sn">ChiShona</option><option value="nd">isiNdebele</option></select></FieldLabel></div><FieldLabel label="Business description" required hint="Explain what the brand offers, who it serves, and why a customer should choose it."><textarea className={textAreaClass} value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /></FieldLabel><div><p className="text-sm font-semibold">Additional categories</p><div className="mt-3 flex flex-wrap gap-2">{businessCategories.map((item) => <button key={item} type="button" onClick={() => toggleCategory(item)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${profile.categories.includes(item) ? "border-business bg-business-soft text-business" : "bg-white"}`}>{profile.categories.includes(item) ? "✓ " : ""}{item}</button>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Central phone"><input className={fieldClass} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="+263..." /></FieldLabel><FieldLabel label="Central WhatsApp"><input className={fieldClass} value={profile.whatsapp} onChange={(event) => setProfile({ ...profile, whatsapp: event.target.value })} placeholder="+263..." /></FieldLabel><FieldLabel label="Central email"><input type="email" className={fieldClass} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></FieldLabel><FieldLabel label="Website"><input className={fieldClass} value={profile.website} onChange={(event) => setProfile({ ...profile, website: event.target.value })} placeholder="https://" /></FieldLabel><FieldLabel label="Instagram"><input className={fieldClass} value={profile.instagram} onChange={(event) => setProfile({ ...profile, instagram: event.target.value })} placeholder="@business" /></FieldLabel><FieldLabel label="Facebook"><input className={fieldClass} value={profile.facebook} onChange={(event) => setProfile({ ...profile, facebook: event.target.value })} /></FieldLabel></div><FieldLabel label="Customer guidance"><textarea className={textAreaClass} value={profile.customerNotes} onChange={(event) => setProfile({ ...profile, customerNotes: event.target.value })} placeholder="Share anything that applies to the whole brand. Put parking, entrance, and local collection details on the exact location." /></FieldLabel><label className="flex items-start gap-3 rounded-2xl border p-4"><input className="mt-1" type="checkbox" checked={profile.public} onChange={(event) => setProfile({ ...profile, public: event.target.checked })} /><span><span className="block text-sm font-semibold">Ready for public visibility</span><span className="mt-1 block text-xs text-secondary">Spotly Admin still controls final publication and private-beta availability.</span></span></label><div className="flex justify-end border-t pt-5"><Button onClick={saveProfile} loading={saving}><Save className="h-4 w-4" />Save business profile</Button></div></div></SectionCard><div className="space-y-5"><Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-business-soft text-business"><Eye className="h-5 w-5" /></span><div><h2 className="font-bold">Listing status</h2><div className="mt-3"><EntityStatus business={business} /></div><p className="mt-3 text-xs leading-5 text-secondary">Public visibility depends on business readiness and Spotly&apos;s publication controls.</p></div></div></Card><ReadinessCard compact /><Button href="/business/branches" variant="outline" className="w-full">Manage exact {locationWord}s<ArrowRight className="h-4 w-4" /></Button></div></div>}

    {tab === "brand" && <SectionCard title="Logo and customer-facing media" description="Use assets that stay clear in search results, confirmations, and large displays."><div className="grid gap-6 p-5 lg:grid-cols-2"><UploadField label="Business logo" value={profile.logo} path={`businesses/${business.id}/branding/logo`} onChange={(value) => setProfile({ ...profile, logo: value })} user={user} /><UploadField label="Cover image" value={profile.coverImage} path={`businesses/${business.id}/branding/cover`} onChange={(value) => setProfile({ ...profile, coverImage: value })} user={user} /><div className="lg:col-span-2 flex justify-end border-t pt-5"><Button onClick={saveProfile} loading={saving}><Save className="h-4 w-4" />Save media</Button></div></div></SectionCard>}

    {tab === "operations" && <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><SectionCard title={operationText.title} description={operationText.description}><div className="space-y-5 p-5"><div className="grid gap-4 sm:grid-cols-3"><FieldLabel label="Default currency"><select className={selectClass} value={ops.defaultCurrency} onChange={(event) => setOps({ ...ops, defaultCurrency: event.target.value })}><option value="USD">USD</option><option value="ZWG">ZiG</option></select></FieldLabel>{hasPickup && <FieldLabel label="Preparation minutes"><input type="number" min="5" className={fieldClass} value={ops.preparationMinutes} onChange={(event) => setOps({ ...ops, preparationMinutes: event.target.value })} /></FieldLabel>}<FieldLabel label={operationText.minimumLabel}><input type="number" min="0" step="0.01" className={fieldClass} value={ops.minimumOrder} onChange={(event) => setOps({ ...ops, minimumOrder: event.target.value })} /></FieldLabel></div>{hasInventory && <FieldLabel label="Availability control"><select className={selectClass} value={ops.inventoryMode} onChange={(event) => setOps({ ...ops, inventoryMode: event.target.value })}><option value="business_choice">Choose per {archetype.nouns.item}</option><option value="quantity">Exact quantity</option><option value="status">Available / low / unavailable</option></select></FieldLabel>}<FieldLabel label="Cancellation approach"><select className={selectClass} value={ops.cancellationPolicy} onChange={(event) => setOps({ ...ops, cancellationPolicy: event.target.value })}>{operationText.cancellation.map((value) => <option key={value} value={value}>{value === "business_review" ? "Review each request" : value === "not_allowed" ? "Not allowed after confirmation" : value.replaceAll("_", " ")}</option>)}</select></FieldLabel><FieldLabel label={operationText.instructionLabel} required><textarea className={textAreaClass} value={ops.pickupInstructions} onChange={(event) => setOps({ ...ops, pickupInstructions: event.target.value })} placeholder={operationText.instructionPlaceholder} /></FieldLabel><div className="grid gap-3 sm:grid-cols-2">{[...(hasPickup ? [{ id: "substitutionsEnabled", label: "Allow substitutions", detail: `The team can propose a replacement when a ${archetype.nouns.item} is unavailable.` }] : []), { id: "autoAcceptOrders", label: operationText.autoLabel, detail: "Turn this on only when availability and capacity are reliable." }, ...(hasPickup ? [{ id: "contactlessPickup", label: "Offer contactless collection", detail: "Show a contactless handover option to customers." }] : [])].map((item) => <label key={item.id} className="flex items-start gap-3 rounded-2xl border p-4"><input className="mt-1" type="checkbox" checked={Boolean(ops[item.id])} onChange={(event) => setOps({ ...ops, [item.id]: event.target.checked })} /><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.detail}</span></span></label>)}</div><div className="flex justify-end border-t pt-5"><Button onClick={saveOperations} loading={saving}><Save className="h-4 w-4" />Save how it operates</Button></div></div></SectionCard><Card className="p-5"><Building2 className="h-6 w-6 text-business" /><h2 className="mt-4 font-bold">Local overrides</h2><p className="mt-2 text-sm leading-6 text-secondary">The business has {branches.length} {locationWord}{branches.length === 1 ? "" : "s"}. Opening hours, local capacity, contact details, and accepted methods belong to each exact {locationWord}.</p><Button href="/business/branches" variant="outline" className="mt-5 w-full">Open {locationWord}s<ArrowRight className="h-4 w-4" /></Button></Card></div>}

    {tab === "notifications" && <SectionCard title="Team notifications" description="Choose the alerts that prevent missed customer actions without creating noise."><div className="space-y-3 p-5">{notificationOptions.map((item) => <label key={item.id} className="flex items-start gap-4 rounded-2xl border p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Bell className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{item.label}</span><span className="mt-1 block text-sm leading-6 text-secondary">{item.detail}</span></span><input type="checkbox" checked={Boolean(ops[item.id])} onChange={(event) => setOps({ ...ops, [item.id]: event.target.checked })} /></label>)}<div className="flex justify-end border-t pt-5"><Button onClick={saveOperations} loading={saving}><Save className="h-4 w-4" />Save notifications</Button></div></div></SectionCard>}

    {tab === "publication" && <div className="grid gap-5 xl:grid-cols-[1fr_380px]"><ReadinessCard /><div className="space-y-5"><Card className="p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business-soft text-business"><FileCheck2 className="h-6 w-6" /></span><h2 className="mt-5 text-xl font-black">Request the final review</h2><p className="mt-2 text-sm leading-6 text-secondary">When every required item is complete, Spotly Admin checks ownership, accuracy, customer clarity, and marketplace readiness.</p><div className="mt-5 rounded-2xl bg-grouped p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Required readiness</span><Badge tone={readiness.ready ? "success" : "warning"}>{readiness.percent}%</Badge></div><p className="mt-2 text-xs leading-5 text-secondary">{readiness.ready ? "Ready to request review." : `${readiness.requiredTotal - readiness.requiredComplete} required area${readiness.requiredTotal - readiness.requiredComplete === 1 ? "" : "s"} remain.`}</p></div><Button className="mt-5 w-full" disabled={!readiness.ready || business.status === "pending_publication_review"} loading={reviewing} onClick={requestReview}>{business.status === "pending_publication_review" ? <><CheckCircle2 className="h-4 w-4" />Review requested</> : <><ShieldCheck className="h-4 w-4" />Request publication review</>}</Button></Card><Card className="p-5"><div className="flex items-start gap-4"><Languages className="mt-1 h-5 w-5 text-business" /><div><h3 className="font-bold">Multilingual content ready</h3><p className="mt-1 text-sm leading-6 text-secondary">English, ChiShona, and isiNdebele content can be added progressively without changing the business structure.</p></div></div></Card></div></div>}

    <FullScreenTask open={task.open} state={task.state} title={task.title} description={task.description} steps={["Check required information", "Save the business record", "Refresh related screens", "Finish"]} activeStep={task.active} onDone={() => setTask((current) => ({ ...current, open: false }))} doneLabel="Return to settings" />
  </div>;
}
