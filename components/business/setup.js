"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  HelpCircle,
  Sparkles,
  Store
} from "lucide-react";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { FieldLabel, WorkspaceContextSwitcher, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";
import { saveBranch, saveBusinessProfile } from "@/lib/firebase-services";
import { importCatalogTemplate, markLaunchCriticalBusinessChange, saveBusinessOperationalSettings } from "@/lib/business-services";
import { businessCategories, defaultBranch, zimbabweCities } from "@/data/business-config";
import { evaluateSetupSteps, resolveSetupStep } from "@/lib/business-lifecycle";
import { businessHref } from "@/lib/business-routing";
import {
  BUSINESS_ARCHETYPES,
  BUSINESS_OPERATING_MODELS,
  SETUP_STEPS,
  capabilitiesFor,
  inferBusinessType
} from "@/data/business-archetypes";

function ChoiceCard({ selected, icon: Icon, title, description, onClick, badge }) {
  return <button type="button" onClick={onClick} className={`relative flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition ${selected ? "border-business bg-business-soft shadow-sm ring-2 ring-business/10" : "bg-[var(--surface)] hover:border-business/30 hover:shadow-card"}`}>
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-business text-[var(--on-business)]" : "bg-grouped text-secondary"}`}>{Icon ? <Icon className="h-6 w-6" /> : <Store className="h-6 w-6" />}</span>
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-bold">{title}</span>{badge && <Badge tone="accent">{badge}</Badge>}</span><span className="mt-1.5 block text-sm leading-6 text-secondary">{description}</span></span>
    <span className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-business bg-business text-[var(--on-business)]" : "bg-[var(--surface)]"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
  </button>;
}

function StepRail({ steps, currentId, completed }) {
  const currentPosition = steps.findIndex((item) => item.id === currentId);
  return <aside className="hidden w-[290px] shrink-0 xl:block"><div className="sticky top-28 rounded-3xl border bg-[var(--surface)] p-4 shadow-card"><p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[.16em] text-business">Your launch path</p><div className="space-y-1">{steps.map((step, index) => { const Icon = step.icon; const done = completed.includes(step.id); const active = step.id === currentId; return <div key={step.id} aria-current={active ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl p-3 ${active ? "bg-business-soft" : ""}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-[var(--success)] text-[var(--on-success)]" : active ? "bg-business text-[var(--on-business)]" : "bg-grouped text-tertiary"}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span className="min-w-0"><span className={`block text-sm font-bold ${active ? "text-business" : ""}`}>{step.short}</span><span className="mt-0.5 block text-[11px] leading-4 text-secondary">{step.label}</span></span></div>; })}</div></div></aside>;
}

function IdentityStep({ draft, setDraft }) {
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 1</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Start with the business, not the branch</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">A business is the brand customers recognize. A branch is one location belonging to that business. Confirm the brand once; add or assign locations afterwards.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Business or brand name" required><input className={fieldClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Example: OK Zimbabwe" /></FieldLabel><FieldLabel label="Legal or registered name" hint="Optional for now. You can add this later."><input className={fieldClass} value={draft.legalName} onChange={(event) => setDraft({ ...draft, legalName: event.target.value })} /></FieldLabel></div><FieldLabel label="What kind of business is this?" required hint="This shapes the workspace, vocabulary, setup steps, and customer experience."><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.values(BUSINESS_ARCHETYPES).map((type) => <ChoiceCard key={type.id} selected={draft.businessType === type.id} icon={type.icon} title={type.label} description={type.description} onClick={() => setDraft({ ...draft, businessType: type.id, capabilities: capabilitiesFor(type.id), category: type.categoryHints.includes(draft.category) ? draft.category : type.categoryHints[0] })} />)}</div></FieldLabel><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Primary category"><select className={selectClass} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{businessCategories.map((item) => <option key={item}>{item}</option>)}</select></FieldLabel><FieldLabel label="Public description" hint="A short, customer-friendly explanation. You can refine it later."><textarea className={textAreaClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What can customers find or do here?" /></FieldLabel></div></div>;
}

function OperationStep({ draft, setDraft }) {
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 2</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">How does this business operate?</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Choose the closest model. Spotly will hide unnecessary location and branch controls until they are relevant.</p></div><div className="grid gap-3 md:grid-cols-2">{BUSINESS_OPERATING_MODELS.map((model) => <ChoiceCard key={model.id} selected={draft.operatingModel === model.id} title={model.label} description={model.description} onClick={() => setDraft({ ...draft, operatingModel: model.id })} />)}</div><Card className="border-business/20 bg-business-soft p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface)] text-business"><Sparkles className="h-5 w-5" /></span><div><h3 className="font-bold">Spotly keeps the structure out of your way</h3><p className="mt-1 text-sm leading-6 text-secondary">Single-location businesses see one location. Multi-location owners can add branches and assign staff. Branch managers see only the locations assigned to them.</p></div></div></Card></div>;
}

function LocationStep({ branchDraft, setBranchDraft, operatingModel }) {
  const noPublicLocation = ["online_only", "mobile_service"].includes(operatingModel);
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 3</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{noPublicLocation ? "Set the operating base" : "Confirm the first customer location"}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">This is a location belonging to the business—not a separate business. You can add more later when the business genuinely has more branches or venues.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Location name" required hint="Use a short location name such as Hillside, Borrowdale, or Main office."><input className={fieldClass} value={branchDraft.branchName || branchDraft.name || ""} onChange={(event) => setBranchDraft({ ...branchDraft, name: event.target.value, branchName: event.target.value })} placeholder="Main location" /></FieldLabel><FieldLabel label="City or town" required><select className={selectClass} value={branchDraft.city || "Harare"} onChange={(event) => setBranchDraft({ ...branchDraft, city: event.target.value })}>{zimbabweCities.map((item) => <option key={item}>{item}</option>)}</select></FieldLabel><FieldLabel label={noPublicLocation ? "Operating address" : "Customer address"} className="sm:col-span-2"><input className={fieldClass} value={branchDraft.address || ""} onChange={(event) => setBranchDraft({ ...branchDraft, address: event.target.value })} placeholder="Street, building, shopping centre, suburb" /></FieldLabel><FieldLabel label="Location phone"><input className={fieldClass} value={branchDraft.phone || ""} onChange={(event) => setBranchDraft({ ...branchDraft, phone: event.target.value })} placeholder="+263" /></FieldLabel><FieldLabel label="Location email"><input type="email" className={fieldClass} value={branchDraft.email || ""} onChange={(event) => setBranchDraft({ ...branchDraft, email: event.target.value })} /></FieldLabel></div><label className="flex items-start gap-3 rounded-2xl border p-4"><input type="checkbox" className="mt-1" checked={branchDraft.public !== false && !noPublicLocation} disabled={noPublicLocation} onChange={(event) => setBranchDraft({ ...branchDraft, public: event.target.checked })} /><span><span className="block text-sm font-bold">Show this location to customers</span><span className="mt-1 block text-xs leading-5 text-secondary">{noPublicLocation ? "Online and mobile businesses do not need a public address." : "Customers will see it after the business is approved for publication."}</span></span></label></div>;
}

function OfferingStep({ draft, setDraft }) {
  const type = BUSINESS_ARCHETYPES[draft.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const options = [
    ["catalog", "Publish products or items"], ["inventory", "Track availability or stock"], ["pickup_orders", "Accept pickup orders"], ["menu", "Publish a food menu"], ["preparation", "Manage preparation times"], ["events", "Create events"], ["tickets", "Sell ticket types"], ["attendees", "Check guests in"], ["services", "List services"], ["appointments", "Accept appointments"], ["bookings", "Accept bookings"], ["capacity", "Manage capacity"], ["promotions", "Run promotions"], ["kiosk_pickup", "Use pickup kiosks"], ["kiosk_ordering", "Use self-order kiosks"], ["kiosk_checkin", "Use check-in kiosks"], ["profile", "Publish a business profile"], ["enquiries", "Accept customer enquiries"]
  ];
  const suggested = new Set(type.capabilities);
  const relevant = options.filter(([id]) => suggested.has(id) || draft.capabilities.includes(id));
  function toggle(id) { setDraft({ ...draft, capabilities: draft.capabilities.includes(id) ? draft.capabilities.filter((item) => item !== id) : [...draft.capabilities, id] }); }
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 4</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">What should customers be able to do?</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Spotly has selected the most relevant capabilities for a {type.label.toLowerCase()}. Keep what matters; leave the rest off.</p></div><div className="grid gap-3 sm:grid-cols-2">{relevant.map(([id, label]) => { const checked = draft.capabilities.includes(id); return <button type="button" key={id} onClick={() => toggle(id)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${checked ? "border-business bg-business-soft" : "bg-[var(--surface)]"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${checked ? "bg-business text-[var(--on-business)]" : "bg-grouped text-tertiary"}`}>{checked ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><span className="text-sm font-bold">{label}</span></button>; })}</div><Card className="p-5"><div className="flex items-start gap-4"><HelpCircle className="mt-0.5 h-5 w-5 text-business" /><div><h3 className="font-bold">Nothing is permanent</h3><p className="mt-1 text-sm leading-6 text-secondary">An authorized owner can turn capabilities on later. Spotly will then introduce the matching workflow and setup steps.</p></div></div></Card></div>;
}

function StarterStep({ templates, selectedTemplateIds, setSelectedTemplateIds, archetype }) {
  const compatible = templates.filter((template) => !template.businessTypes?.length || template.businessTypes.includes(archetype.id) || template.type === archetype.id || (archetype.id === "grocery_retail" && template.type === "grocery"));
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 5</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Do not start from an empty screen</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Select starter structures that match the business. They create editable drafts—not invented prices or claims.</p></div>{compatible.length ? <div className="grid gap-3 md:grid-cols-2">{compatible.map((template) => <ChoiceCard key={template.id} selected={selectedTemplateIds.includes(template.id)} title={template.name} description={`${template.products?.length || template.items?.length || 0} editable starter ${archetype.nouns.items}`} badge={template.provisional ? "Review required" : "Starter"} onClick={() => setSelectedTemplateIds((current) => current.includes(template.id) ? current.filter((id) => id !== template.id) : [...current, template.id])} />)}</div> : <Card className="p-6"><h3 className="font-bold">Your workspace will start clean and guided</h3><p className="mt-2 text-sm leading-6 text-secondary">There is no reliable starter template for this business type yet. Spotly will open the correct creation flow with examples and required fields.</p></Card>}<p className="text-xs leading-5 text-secondary">Spotly does not publish imported starter content until the business confirms names, prices, dates, availability, and customer-facing details.</p></div>;
}

function ReviewStep({ draft, branchDraft, selectedTemplateIds, setupEvaluation }) {
  const archetype = BUSINESS_ARCHETYPES[draft.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const incomplete = (setupEvaluation?.steps || []).filter((item) => item.required && !item.complete);
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Final step</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Finish the business basics</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Review the essentials you have confirmed. Finishing this step does not make the business live; it takes you to the Launch Checklist for products, locations, Money, team, and the final Spotly review.</p></div>{incomplete.length > 0 && <Card variant="bordered" className="border-warning/30 bg-[var(--warning-soft)] p-5"><h3 className="font-bold">{incomplete.length} basic {incomplete.length === 1 ? "step needs" : "steps need"} attention</h3><p className="mt-1 text-sm leading-6 text-secondary">Nothing was lost. Fix the items below, then return to Review.</p><div className="mt-4 space-y-2">{incomplete.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-[var(--surface)] p-3"><Circle className="h-4 w-4 shrink-0 text-warning" /><span className="min-w-0 flex-1 text-sm font-semibold">{item.label}</span></div>)}</div></Card>}<div className="grid gap-4 md:grid-cols-2"><Card className="p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-tertiary">Business</p><h3 className="mt-3 text-xl font-semibold">{draft.name}</h3><p className="mt-1 text-sm text-secondary">{archetype.label} · {draft.category}</p><p className="mt-4 text-sm leading-6 text-secondary">{draft.description || "Description can be completed from the guided setup centre."}</p></Card><Card className="p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-tertiary">First {archetype.nouns.branch}</p><h3 className="mt-3 text-xl font-semibold">{branchDraft.branchName || branchDraft.name || "Main location"}</h3><p className="mt-1 text-sm text-secondary">{branchDraft.city || "Zimbabwe"}</p><p className="mt-4 text-sm leading-6 text-secondary">{branchDraft.address || "Address will be confirmed before publication."}</p></Card></div><Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-business-soft text-business"><CheckCircle2 className="h-5 w-5" /></span><div><h3 className="font-bold">What happens next</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-secondary"><li>• Your business basics are saved</li><li>• The Launch Checklist identifies the exact remaining launch requirements</li><li>• {selectedTemplateIds.length ? `${selectedTemplateIds.length} selected starter template${selectedTemplateIds.length === 1 ? "" : "s"}` : "Your catalogue can be prepared from the launch checklist"}</li><li>• Spotly reviews are shown separately from work that still belongs to you</li></ul></div></div></Card></div>;
}

function resolutionFromLifecycleSetup({ requestedStep = "", setup = {}, activeSteps = [] } = {}) {
  const activeIds = activeSteps.map((item) => item.id);
  const requestedIndex = activeIds.indexOf(requestedStep);
  const firstIncompleteIndex = setup.firstIncompleteId ? activeIds.indexOf(setup.firstIncompleteId) : -1;
  if (setup.complete) return { ...setup, stepId: requestedIndex >= 0 ? requestedStep : null, redirectToLaunch: requestedIndex < 0 };
  if (requestedStep === "review" && requestedIndex >= 0) return { ...setup, stepId: requestedStep, redirectToLaunch: false };
  if (requestedIndex >= 0 && (firstIncompleteIndex < 0 || requestedIndex <= firstIncompleteIndex)) return { ...setup, stepId: requestedStep, redirectToLaunch: false };
  return { ...setup, stepId: setup.firstIncompleteId || activeIds[0] || "identity", redirectToLaunch: false };
}

function currentFieldProgress(stepId, draft, branchDraft) {
  const fields = stepId === "identity" ? [
    ["Business name", Boolean(draft.name?.trim())],
    ["Business type", Boolean(draft.businessType)],
    ["Primary category", Boolean(draft.category)]
  ] : stepId === "operation" ? [["Operating model", Boolean(draft.operatingModel)]]
    : stepId === "location" ? [["Location name", Boolean((branchDraft.branchName || branchDraft.name)?.trim())], ["City or town", Boolean(branchDraft.city)]]
      : stepId === "offering" ? [["Customer capabilities", Boolean(draft.capabilities?.length)]]
        : [];
  return { fields, complete: fields.filter(([, done]) => done).length, total: fields.length };
}

export function BusinessSetupView() {
  const workspace = useBusinessWorkspace();
  const { business, branches, selectedBranch, templates, user, selectedBusinessId } = workspace;
  const canonicalLocation = workspace.lifecycle?.canonicalLocation || null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const headingRef = useRef(null);
  const initialType = inferBusinessType(business || {});
  const initialOperatingModel = business?.operatingModel || (branches.length > 1 ? "physical_multi" : "physical_single");
  const initialName = business?.brandName || business?.name || "";
  const initialCategory = business?.category || "Other";
  const [draft, setDraft] = useState({
    name: business?.brandName || business?.name || "",
    legalName: business?.legalName || "",
    category: business?.category || "Other",
    description: business?.description || "",
    businessType: initialType,
    capabilities: business?.capabilities || capabilitiesFor(initialType),
    operatingModel: business?.operatingModel || (branches.length > 1 ? "physical_multi" : "physical_single")
  });
  const initialBranch = branches.find((item) => item.id === canonicalLocation?.id) || canonicalLocation || selectedBranch || branches[0] || {};
  const [branchDraft, setBranchDraft] = useState({ ...defaultBranch, ...initialBranch, id: initialBranch.id || canonicalLocation?.id || "", name: initialBranch.branchName || initialBranch.name || "Main location", branchName: initialBranch.branchName || initialBranch.name || "Main location" });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(business?.onboarding?.lastSavedAt || null);
  const [dirty, setDirty] = useState(false);
  const [optimisticBusiness, setOptimisticBusiness] = useState(null);
  const [optimisticBranches, setOptimisticBranches] = useState(null);
  const [optimisticOperations, setOptimisticOperations] = useState(null);
  const requestedStep = searchParams.get("step") || "";
  const archetype = BUSINESS_ARCHETYPES[draft.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const activeSteps = SETUP_STEPS.filter((item) => archetype.setup.includes(item.id));
  const setupBusiness = optimisticBusiness || business;
  const setupBranches = optimisticBranches || branches;
  const setupOperations = optimisticOperations || workspace.operations;
  const authoritativeSetup = !optimisticBusiness && workspace.lifecycleAuthoritative && workspace.lifecycle?.setup?.steps?.length ? workspace.lifecycle.setup : null;
  const persistedResolution = authoritativeSetup
    ? resolutionFromLifecycleSetup({ requestedStep, setup: authoritativeSetup, activeSteps })
    : resolveSetupStep({ requestedStep, business: setupBusiness, branches: setupBranches, products: workspace.products, operations: setupOperations });
  const resolvedStepId = requestedStep && activeSteps.some((item) => item.id === requestedStep)
    ? (persistedResolution.stepId || requestedStep)
    : (persistedResolution.stepId || activeSteps[0]?.id || "identity");
  const currentPosition = Math.max(0, activeSteps.findIndex((item) => item.id === resolvedStepId));
  const step = activeSteps[currentPosition] || activeSteps[0];
  const previousStep = activeSteps[currentPosition - 1] || null;
  const nextStep = activeSteps[currentPosition + 1] || null;
  const persistedEvaluation = authoritativeSetup || evaluateSetupSteps({ business: setupBusiness, branches: setupBranches, products: workspace.products, operations: setupOperations });
  const fieldProgress = currentFieldProgress(step.id, draft, branchDraft);
  const typeChanged = draft.businessType !== initialType;
  const launchCriticalBasicsChanged = step?.id === "identity"
    ? (typeChanged || draft.name.trim() !== initialName.trim() || draft.category !== initialCategory)
    : step?.id === "operation"
      ? draft.operatingModel !== initialOperatingModel
      : false;

  useEffect(() => {
    if (persistedResolution.redirectToLaunch && !requestedStep) {
      router.replace(businessHref("/business/launch", { businessId: selectedBusinessId }));
    }
  }, [persistedResolution.redirectToLaunch, requestedStep, router, selectedBusinessId]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step.id]);

  useEffect(() => {
    if (!optimisticBusiness || !savedAt || business?.onboarding?.lastSavedAt !== savedAt) return;
    const actual = evaluateSetupSteps({ business, branches, products: workspace.products, operations: workspace.operations });
    const optimistic = evaluateSetupSteps({ business: optimisticBusiness, branches: optimisticBranches || branches, products: workspace.products, operations: optimisticOperations || workspace.operations });
    if (actual.requiredComplete >= optimistic.requiredComplete) {
      setOptimisticBusiness(null);
      setOptimisticBranches(null);
      setOptimisticOperations(null);
    }
  }, [business, branches, optimisticBranches, optimisticBusiness, optimisticOperations, savedAt, workspace.operations, workspace.products]);

  useEffect(() => {
    function beforeUnload(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function interceptLink(event) {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      if (window.confirm("You have unsaved changes. Leave this step and discard them?")) {
        setDirty(false);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [dirty]);

  function patchDraft(next) { setDraft(next); setDirty(true); }
  function patchBranch(next) { setBranchDraft(next); setDirty(true); }

  function validateCurrentStep() {
    if (step.id === "identity" && !draft.name.trim()) { toast("Enter the business or brand name.", { type: "error", title: "Business name required" }); return false; }
    if (step.id === "identity" && !draft.businessType) { toast("Choose the closest business type.", { type: "error", title: "Business type required" }); return false; }
    if (step.id === "operation" && !draft.operatingModel) { toast("Choose how this business operates.", { type: "error", title: "Operating model required" }); return false; }
    if (step.id === "location" && !(branchDraft.branchName || branchDraft.name)?.trim()) { toast("Give the location a short name.", { type: "error", title: "Location name required" }); return false; }
    if (step.id === "location" && !branchDraft.city) { toast("Choose the city or town for this location.", { type: "error", title: "City required" }); return false; }
    return true;
  }

  async function persist(intent = "continue") {
    if (!validateCurrentStep()) return;
    if (step.id === "review" && authoritativeSetup && !authoritativeSetup.requiredBasicsComplete) {
      const blocker = authoritativeSetup.firstIncompleteId || "identity";
      toast("One required business-basic step still needs attention before you can finish.", { type: "error", title: "Business basics still need attention" });
      router.push(businessHref("/business/setup", { businessId: selectedBusinessId, step: blocker }));
      return;
    }
    const finish = !nextStep;
    const leave = intent === "leave";
    const now = new Date().toISOString();
    const metadataCompletedSteps = [...new Set([...(setupBusiness?.onboarding?.completedSteps || []), step.id])];
    setSaving(true);
    try {
      let resolvedBranchId = branchDraft.id || workspace.lifecycle?.canonicalLocation?.id || business?.primaryBranchId || business?.primaryLocationId || "";
      let projectedBranches = branches;
      let projectedOperations = workspace.operations;

      if (step.id === "location") {
        resolvedBranchId = await saveBranch({
          ...branchDraft,
          id: resolvedBranchId || undefined,
          name: branchDraft.branchName || branchDraft.name || "Main location",
          branchName: branchDraft.branchName || branchDraft.name || "Main location",
          status: branchDraft.status === "provisional" ? "draft" : branchDraft.status || "draft"
        }, selectedBusinessId, business?.organizationId, user, { makePrimary: true });
        const savedBranch = {
          ...branchDraft,
          id: resolvedBranchId,
          businessId: selectedBusinessId,
          name: branchDraft.branchName || branchDraft.name || "Main location",
          branchName: branchDraft.branchName || branchDraft.name || "Main location",
          status: branchDraft.status === "provisional" ? "draft" : branchDraft.status || "draft"
        };
        projectedBranches = branches.some((item) => item.id === resolvedBranchId)
          ? branches.map((item) => item.id === resolvedBranchId ? { ...item, ...savedBranch } : item)
          : [savedBranch, ...branches];
        if (!branchDraft.id && resolvedBranchId) setBranchDraft((current) => ({ ...current, id: resolvedBranchId }));
      }

      if (step.id === "offering") {
        projectedOperations = {
          ...workspace.operations,
          businessType: draft.businessType,
          capabilities: draft.capabilities,
          pickupInstructions: workspace.operations.pickupInstructions || (draft.capabilities.includes("pickup_orders") ? "Bring your order number and collect from the designated pickup point." : "")
        };
        await saveBusinessOperationalSettings(selectedBusinessId, projectedOperations, user);
      }

      if (step.id === "starter" && selectedTemplateIds.length) {
        for (const templateId of selectedTemplateIds) {
          const template = templates.find((item) => item.id === templateId);
          if (template) await importCatalogTemplate(template, selectedBusinessId, user, {
            active: false,
            currency: workspace.operations.defaultCurrency || "USD",
            pickupEligible: archetype.capabilities.includes("pickup_orders"),
            substitutionAllowed: archetype.id === "grocery_retail",
            branchIds: resolvedBranchId ? [resolvedBranchId] : []
          });
        }
      }

      const profileChanges = {};
      if (step.id === "identity") Object.assign(profileChanges, {
        name: draft.name,
        brandName: draft.name,
        legalName: draft.legalName,
        category: draft.category,
        categories: [draft.category],
        description: draft.description,
        businessType: draft.businessType
      });
      if (step.id === "operation") profileChanges.operatingModel = draft.operatingModel;
      if (step.id === "offering") profileChanges.capabilities = draft.capabilities;

      const baseOnboarding = {
        ...(setupBusiness?.onboarding || {}),
        currentStep: finish ? "review" : leave ? step.id : (nextStep?.id || step.id),
        lastVisitedStep: leave ? step.id : (nextStep?.id || step.id),
        completedSteps: metadataCompletedSteps,
        startedAt: setupBusiness?.onboarding?.startedAt || now,
        updatedAt: now,
        lastSavedAt: now,
        ...(finish ? { completedAt: now } : {})
      };
      const projectedBusinessBeforeProgress = {
        ...setupBusiness,
        ...profileChanges,
        onboarding: baseOnboarding
      };
      const projectedEvaluation = evaluateSetupSteps({
        business: projectedBusinessBeforeProgress,
        branches: projectedBranches,
        products: workspace.products,
        operations: projectedOperations
      });
      const completedSteps = projectedEvaluation.steps.filter((item) => item.complete).map((item) => item.id);
      const nextIncomplete = projectedEvaluation.firstIncompleteId;
      const onboarding = {
        ...baseOnboarding,
        currentStep: projectedEvaluation.complete ? "review" : leave ? step.id : (nextIncomplete || nextStep?.id || step.id),
        lastVisitedStep: projectedEvaluation.complete ? "review" : leave ? step.id : (nextIncomplete || nextStep?.id || step.id),
        completedSteps,
        percent: projectedEvaluation.percent
      };
      const onboardingStatus = projectedEvaluation.complete ? "complete" : "in_progress";
      const projectedBusiness = { ...projectedBusinessBeforeProgress, onboarding, onboardingStatus };

      await saveBusinessProfile(selectedBusinessId, {
        ...profileChanges,
        onboardingStatus,
        onboarding
      }, user);

      if (launchCriticalBasicsChanged) {
        await markLaunchCriticalBusinessChange(selectedBusinessId, {
          id: "business_basics",
          label: "Business basics changed",
          description: "A launch-critical business identity, category, type, or operating-model detail changed after a launch review decision.",
          href: businessHref("/business/setup", { businessId: selectedBusinessId, step: "identity" })
        });
      }

      // Re-read the same server-authoritative lifecycle snapshot used by Portfolio and launch review.
      // Navigation never guesses from a lagging client subscription after a successful save.
      const confirmedLifecycle = await workspace.refreshLifecycle(selectedBusinessId, { silent: true });
      const confirmedSetup = confirmedLifecycle?.setup || projectedEvaluation;

      // Keep navigation/progress stable while Firestore listeners catch up with the confirmed writes.
      setOptimisticBusiness(projectedBusiness);
      setOptimisticBranches(projectedBranches);
      setOptimisticOperations(projectedOperations);
      setDirty(false);
      setSavedAt(now);
      toast(projectedEvaluation.complete ? "Business basics are complete. Continue with the launch checklist." : "This setup step is saved.", {
        title: projectedEvaluation.complete ? "Business basics complete" : "Progress saved"
      });

      if (leave) {
        router.push(businessHref("/business/launch", { businessId: selectedBusinessId }));
      } else if (step.id === "review") {
        if (confirmedSetup.complete) {
          await workspace.refreshPortfolio();
          router.push(businessHref("/business/launch", { businessId: selectedBusinessId }));
        } else {
          const blocker = confirmedSetup.firstIncompleteId || projectedEvaluation.firstIncompleteId || "identity";
          toast("One business-basic requirement still needs attention before this setup can finish.", { type: "error", title: "Business basics still need attention" });
          router.push(businessHref("/business/setup", { businessId: selectedBusinessId, step: blocker }));
        }
      } else {
        // A successful Save and continue advances to the next wizard step. Earlier validation
        // problems are aggregated on Review instead of silently throwing the merchant backwards.
        const targetStep = nextStep?.id || confirmedSetup.firstIncompleteId || projectedEvaluation.firstIncompleteId || step.id;
        router.push(businessHref("/business/setup", { businessId: selectedBusinessId, step: targetStep }));
      }
    } catch (error) {
      toast(error.message || "This step could not be saved.", { type: "error", title: "Save failed" });
    } finally { setSaving(false); }
  }

  function goBack() {
    if (!previousStep) return;
    if (dirty && !window.confirm("Discard the unsaved changes on this step?")) return;
    setDirty(false);
    router.push(businessHref("/business/setup", { businessId: selectedBusinessId, step: previousStep.id }));
  }

  const reviewHasBlockers = step.id === "review" && !persistedEvaluation.requiredBasicsComplete;
  const content = step.id === "identity" ? <IdentityStep draft={draft} setDraft={patchDraft} />
    : step.id === "operation" ? <OperationStep draft={draft} setDraft={patchDraft} />
      : step.id === "location" ? <LocationStep branchDraft={branchDraft} setBranchDraft={patchBranch} operatingModel={draft.operatingModel} />
        : step.id === "offering" ? <OfferingStep draft={draft} setDraft={patchDraft} />
          : step.id === "starter" ? <StarterStep templates={templates} selectedTemplateIds={selectedTemplateIds} setSelectedTemplateIds={(value) => { setSelectedTemplateIds(value); setDirty(true); }} archetype={archetype} />
            : <ReviewStep draft={draft} branchDraft={branchDraft} selectedTemplateIds={selectedTemplateIds} setupEvaluation={persistedEvaluation} />;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Stage 2 of 5 · Business basics</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Set up the business, step by step</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">This short wizard establishes the business structure. Products, Money, Team and other launch preparation continue separately on the Launch Checklist.</p></div><WorkspaceContextSwitcher showBranch={false} compact /></div>
    <div className="rounded-3xl border bg-[var(--surface)] p-4 shadow-card sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{step.label}</p><p className="mt-1 text-xs text-secondary">Step {currentPosition + 1} of {activeSteps.length} · {persistedEvaluation.requiredComplete} of {persistedEvaluation.requiredTotal} required basics complete</p></div><div className="flex items-center gap-2"><Badge tone={persistedEvaluation.percent === 100 ? "success" : "accent"}>{persistedEvaluation.percent}%</Badge>{saving ? <Badge tone="info">Saving…</Badge> : savedAt ? <Badge tone="neutral">Saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge> : null}</div></div><ProgressBar value={persistedEvaluation.percent} label="Business basics completion" className="mt-4 h-2.5" /></div>
    {typeChanged && <Card variant="bordered" className="border-warning/30 bg-[var(--warning-soft)] p-4"><p className="font-semibold text-warning">Changing the business type will update your launch requirements.</p><p className="mt-1 text-sm leading-6 text-secondary">Products, customer workflows and Money requirements may change after you save this step.</p></Card>}
    <div className="flex items-start gap-6"><StepRail steps={activeSteps} currentId={step.id} completed={persistedEvaluation.steps.filter((item) => item.complete).map((item) => item.id)} /><Card className="min-w-0 flex-1 overflow-hidden"><div className="p-6 sm:p-8 lg:p-10"><div ref={headingRef} tabIndex={-1} className="outline-none"><AnimatePresence mode="wait"><motion.div key={step.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .2 }}>{content}</motion.div></AnimatePresence></div>{fieldProgress.total > 0 && <div className="mt-8 rounded-2xl bg-grouped p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Required details on this step</p><span className="text-xs text-secondary">{fieldProgress.complete} of {fieldProgress.total}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{fieldProgress.fields.map(([label, done]) => <div key={label} className="flex items-center gap-2 text-sm"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-[var(--success)] text-[var(--on-success)]" : "border text-tertiary"}`}>{done ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}</span><span className={done ? "" : "text-secondary"}>{label}</span></div>)}</div></div>}</div><div className="flex flex-col-reverse gap-3 border-t bg-grouped/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Button variant="ghost" disabled={!previousStep || saving} onClick={goBack}><ArrowLeft className="h-4 w-4" />Back</Button><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button variant="outline" disabled={saving} onClick={() => persist("leave")}>Save and leave</Button><Button loading={saving} onClick={() => reviewHasBlockers ? router.push(businessHref("/business/setup", { businessId: selectedBusinessId, step: persistedEvaluation.firstIncompleteId || "identity" })) : persist("continue")}>{reviewHasBlockers ? "Fix remaining basics" : !nextStep ? "Finish business basics" : "Save and continue"}<ArrowRight className="h-4 w-4" /></Button></div></div></Card></div>
  </div>;
}
