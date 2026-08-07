"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { FieldLabel, FullScreenTask, WorkspaceContextSwitcher, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";
import { saveBranch, saveBusinessProfile } from "@/lib/firebase-services";
import { importCatalogTemplate, saveBusinessOperationalSettings } from "@/lib/business-services";
import { businessCategories, defaultBranch, zimbabweCities } from "@/data/business-config";
import {
  BUSINESS_ARCHETYPES,
  BUSINESS_OPERATING_MODELS,
  SETUP_STEPS,
  capabilitiesFor,
  inferBusinessType
} from "@/data/business-archetypes";

function setupIndex(business) {
  const step = business?.onboarding?.currentStep;
  const found = SETUP_STEPS.findIndex((item) => item.id === step);
  return found >= 0 ? found : 0;
}

function ChoiceCard({ selected, icon: Icon, title, description, onClick, badge }) {
  return <button type="button" onClick={onClick} className={`relative flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition ${selected ? "border-business bg-business-soft shadow-sm ring-2 ring-business/10" : "bg-white hover:border-business/30 hover:shadow-card"}`}>
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-business text-white" : "bg-grouped text-secondary"}`}>{Icon ? <Icon className="h-6 w-6" /> : <Store className="h-6 w-6" />}</span>
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-bold">{title}</span>{badge && <Badge tone="accent">{badge}</Badge>}</span><span className="mt-1.5 block text-sm leading-6 text-secondary">{description}</span></span>
    <span className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-business bg-business text-white" : "bg-white"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
  </button>;
}

function StepRail({ steps, currentId, completed }) {
  const currentPosition = steps.findIndex((item) => item.id === currentId);
  return <aside className="hidden w-[290px] shrink-0 xl:block"><div className="sticky top-28 rounded-3xl border bg-white p-4 shadow-card"><p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[.16em] text-business">Your launch path</p><div className="space-y-1">{steps.map((step, index) => { const Icon = step.icon; const done = completed.includes(step.id) || index < currentPosition; const active = step.id === currentId; return <div key={step.id} aria-current={active ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl p-3 ${active ? "bg-business-soft" : ""}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-emerald-500 text-white" : active ? "bg-business text-white" : "bg-grouped text-tertiary"}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span className="min-w-0"><span className={`block text-sm font-bold ${active ? "text-business" : ""}`}>{step.short}</span><span className="mt-0.5 block text-[11px] leading-4 text-secondary">{step.label}</span></span></div>; })}</div></div></aside>;
}

function IdentityStep({ draft, setDraft }) {
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 1</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Start with the business, not the branch</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">A business is the brand customers recognize. A branch is one location belonging to that business. Confirm the brand once; add or assign locations afterwards.</p></div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Business or brand name" required><input className={fieldClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Example: OK Zimbabwe" /></FieldLabel><FieldLabel label="Legal or registered name" hint="Optional for now. You can add this later."><input className={fieldClass} value={draft.legalName} onChange={(event) => setDraft({ ...draft, legalName: event.target.value })} /></FieldLabel></div><FieldLabel label="What kind of business is this?" required hint="This shapes the workspace, vocabulary, setup steps, and customer experience."><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.values(BUSINESS_ARCHETYPES).map((type) => <ChoiceCard key={type.id} selected={draft.businessType === type.id} icon={type.icon} title={type.label} description={type.description} onClick={() => setDraft({ ...draft, businessType: type.id, capabilities: capabilitiesFor(type.id), category: type.categoryHints.includes(draft.category) ? draft.category : type.categoryHints[0] })} />)}</div></FieldLabel><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Primary category"><select className={selectClass} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{businessCategories.map((item) => <option key={item}>{item}</option>)}</select></FieldLabel><FieldLabel label="Public description" hint="A short, customer-friendly explanation. You can refine it later."><textarea className={textAreaClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What can customers find or do here?" /></FieldLabel></div></div>;
}

function OperationStep({ draft, setDraft }) {
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 2</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">How does this business operate?</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Choose the closest model. Spotly will hide unnecessary location and branch controls until they are relevant.</p></div><div className="grid gap-3 md:grid-cols-2">{BUSINESS_OPERATING_MODELS.map((model) => <ChoiceCard key={model.id} selected={draft.operatingModel === model.id} title={model.label} description={model.description} onClick={() => setDraft({ ...draft, operatingModel: model.id })} />)}</div><Card className="border-business/20 bg-business-soft p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-business"><Sparkles className="h-5 w-5" /></span><div><h3 className="font-bold">Spotly keeps the structure out of your way</h3><p className="mt-1 text-sm leading-6 text-secondary">Single-location businesses see one location. Multi-location owners can add branches and assign staff. Branch managers see only the locations assigned to them.</p></div></div></Card></div>;
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
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 4</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">What should customers be able to do?</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Spotly has selected the most relevant capabilities for a {type.label.toLowerCase()}. Keep what matters; leave the rest off.</p></div><div className="grid gap-3 sm:grid-cols-2">{relevant.map(([id, label]) => { const checked = draft.capabilities.includes(id); return <button type="button" key={id} onClick={() => toggle(id)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${checked ? "border-business bg-business-soft" : "bg-white"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${checked ? "bg-business text-white" : "bg-grouped text-tertiary"}`}>{checked ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><span className="text-sm font-bold">{label}</span></button>; })}</div><Card className="p-5"><div className="flex items-start gap-4"><HelpCircle className="mt-0.5 h-5 w-5 text-business" /><div><h3 className="font-bold">Nothing is permanent</h3><p className="mt-1 text-sm leading-6 text-secondary">An authorized owner can turn capabilities on later. Spotly will then introduce the matching workflow and setup steps.</p></div></div></Card></div>;
}

function StarterStep({ templates, selectedTemplateIds, setSelectedTemplateIds, archetype }) {
  const compatible = templates.filter((template) => !template.businessTypes?.length || template.businessTypes.includes(archetype.id) || template.type === archetype.id || (archetype.id === "grocery_retail" && template.type === "grocery"));
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Step 5</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Do not start from an empty screen</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Select starter structures that match the business. They create editable drafts—not invented prices or claims.</p></div>{compatible.length ? <div className="grid gap-3 md:grid-cols-2">{compatible.map((template) => <ChoiceCard key={template.id} selected={selectedTemplateIds.includes(template.id)} title={template.name} description={`${template.products?.length || template.items?.length || 0} editable starter ${archetype.nouns.items}`} badge={template.provisional ? "Review required" : "Starter"} onClick={() => setSelectedTemplateIds((current) => current.includes(template.id) ? current.filter((id) => id !== template.id) : [...current, template.id])} />)}</div> : <Card className="p-6"><h3 className="font-bold">Your workspace will start clean and guided</h3><p className="mt-2 text-sm leading-6 text-secondary">There is no reliable starter template for this business type yet. Spotly will open the correct creation flow with examples and required fields.</p></Card>}<p className="text-xs leading-5 text-secondary">Spotly does not publish imported starter content until the business confirms names, prices, dates, availability, and customer-facing details.</p></div>;
}

function ReviewStep({ draft, branchDraft, selectedTemplateIds }) {
  const archetype = BUSINESS_ARCHETYPES[draft.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Final step</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">A focused workspace is ready to be created</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">Review the essentials. Detailed finance, staff, and publication settings will appear later—when they are useful.</p></div><div className="grid gap-4 md:grid-cols-2"><Card className="p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-tertiary">Business</p><h3 className="mt-3 text-xl font-semibold">{draft.name}</h3><p className="mt-1 text-sm text-secondary">{archetype.label} · {draft.category}</p><p className="mt-4 text-sm leading-6 text-secondary">{draft.description || "Description can be completed from the guided setup centre."}</p></Card><Card className="p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-tertiary">First {archetype.nouns.branch}</p><h3 className="mt-3 text-xl font-semibold">{branchDraft.branchName || branchDraft.name || "Main location"}</h3><p className="mt-1 text-sm text-secondary">{branchDraft.city || "Zimbabwe"}</p><p className="mt-4 text-sm leading-6 text-secondary">{branchDraft.address || "Address will be confirmed before publication."}</p></Card></div><Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-business-soft text-business"><CheckCircle2 className="h-5 w-5" /></span><div><h3 className="font-bold">Spotly will now prepare</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-secondary"><li>• A workspace shaped around {archetype.shortLabel.toLowerCase()} operations</li><li>• Clear business and location separation</li><li>• {selectedTemplateIds.length ? `${selectedTemplateIds.length} selected starter template${selectedTemplateIds.length === 1 ? "" : "s"}` : "A guided empty state for the first offering"}</li><li>• A single recommended next action instead of every setting at once</li></ul></div></div></Card></div>;
}

export function BusinessSetupView() {
  const workspace = useBusinessWorkspace();
  const { business, branches, selectedBranch, templates, user, selectedBusinessId } = workspace;
  const router = useRouter();
  const { toast } = useToast();
  const initialType = inferBusinessType(business || {});
  const [current, setCurrent] = useState(() => setupIndex(business));
  const [completed, setCompleted] = useState(business?.onboarding?.completedSteps || []);
  const [draft, setDraft] = useState({
    name: business?.brandName || business?.name || "",
    legalName: business?.legalName || "",
    category: business?.category || "Other",
    description: business?.description || "",
    businessType: initialType,
    capabilities: business?.capabilities || capabilitiesFor(initialType),
    operatingModel: business?.operatingModel || (branches.length > 1 ? "physical_multi" : "physical_single")
  });
  const [branchDraft, setBranchDraft] = useState({ ...defaultBranch, ...(selectedBranch || branches[0] || {}), name: selectedBranch?.branchName || selectedBranch?.name || "Main location", branchName: selectedBranch?.branchName || selectedBranch?.name || "Main location" });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [processing, setProcessing] = useState({ open: false, state: "processing", active: 0, intent: "continue", title: "Saving your progress", description: "Spotly is keeping the business and location structure consistent." });
  const archetype = BUSINESS_ARCHETYPES[draft.businessType] || BUSINESS_ARCHETYPES.directory_profile;
  const activeSteps = SETUP_STEPS.filter((item) => archetype.setup.includes(item.id));
  const normalizedCurrent = archetype.setup.includes(SETUP_STEPS[current]?.id) ? current : SETUP_STEPS.findIndex((item) => archetype.setup.includes(item.id));
  const step = SETUP_STEPS[normalizedCurrent];
  const visiblePosition = activeSteps.findIndex((item) => item.id === step.id);
  const progress = Math.round(((visiblePosition + 1) / activeSteps.length) * 100);

  const nextIndex = useMemo(() => {
    for (let index = normalizedCurrent + 1; index < SETUP_STEPS.length; index += 1) if (archetype.setup.includes(SETUP_STEPS[index].id)) return index;
    return -1;
  }, [normalizedCurrent, archetype]);
  const previousIndex = useMemo(() => {
    for (let index = normalizedCurrent - 1; index >= 0; index -= 1) if (archetype.setup.includes(SETUP_STEPS[index].id)) return index;
    return -1;
  }, [normalizedCurrent, archetype]);

  async function persist({ intent = "continue" } = {}) {
    const finish = intent === "finish";
    const leave = intent === "leave";
    const completedSteps = [...new Set([...completed, step.id])];
    setProcessing({ open: true, state: "processing", active: 0, intent, title: finish ? "Preparing your workspace" : "Saving your progress", description: finish ? "Spotly is shaping the workspace around this business." : leave ? "Spotly is saving this exact step so you can return without losing your place." : "Your setup can be safely continued from any device." });
    try {
      await saveBusinessProfile(selectedBusinessId, {
        name: draft.name,
        brandName: draft.name,
        legalName: draft.legalName,
        category: draft.category,
        categories: [draft.category],
        description: draft.description,
        businessType: draft.businessType,
        capabilities: draft.capabilities,
        operatingModel: draft.operatingModel,
        onboardingStatus: finish ? "complete" : "in_progress",
        onboarding: {
          ...(business?.onboarding || {}),
          currentStep: finish ? "review" : leave ? step.id : (SETUP_STEPS[nextIndex]?.id || "review"),
          completedSteps,
          percent: finish ? 100 : progress,
          startedAt: business?.onboarding?.startedAt || new Date().toISOString(),
          lastSavedAt: new Date().toISOString(),
          ...(finish ? { completedAt: new Date().toISOString() } : {})
        }
      }, user);
      setProcessing((value) => ({ ...value, active: 1 }));
      let resolvedBranchId = branchDraft.id || "";
      if (["location", "review"].includes(step.id) || finish) {
        resolvedBranchId = await saveBranch({ ...branchDraft, id: branchDraft.id, name: branchDraft.branchName || branchDraft.name || "Main location", branchName: branchDraft.branchName || branchDraft.name || "Main location", status: branchDraft.status === "provisional" ? "draft" : branchDraft.status || "draft" }, selectedBusinessId, business?.organizationId, user);
        if (!branchDraft.id && resolvedBranchId) setBranchDraft((current) => ({ ...current, id: resolvedBranchId }));
      }
      setProcessing((value) => ({ ...value, active: 2 }));
      if (step.id === "offering" || finish) {
        await saveBusinessOperationalSettings(selectedBusinessId, {
          ...workspace.operations,
          businessType: draft.businessType,
          capabilities: draft.capabilities,
          pickupInstructions: workspace.operations.pickupInstructions || (draft.capabilities.includes("pickup_orders") ? "Bring your order number and collect from the designated pickup point." : "")
        }, user);
      }
      if ((step.id === "starter" || finish) && selectedTemplateIds.length) {
        for (const templateId of selectedTemplateIds) {
          const template = templates.find((item) => item.id === templateId);
          if (template) await importCatalogTemplate(template, selectedBusinessId, user, { active: false, currency: workspace.operations.defaultCurrency || "USD", pickupEligible: archetype.capabilities.includes("pickup_orders"), substitutionAllowed: archetype.id === "grocery_retail", branchIds: resolvedBranchId ? [resolvedBranchId] : [] });
        }
      }
      setCompleted(completedSteps);
      setProcessing({ open: true, state: "success", active: 3, intent, title: finish ? "Your focused workspace is ready" : "Progress saved", description: finish ? "Open the workspace to see one clear next action and only the tools this business needs." : leave ? "Your place is saved. The home screen will show exactly where to continue." : "This step is complete and the next one is ready." });
    } catch (error) {
      setProcessing({ open: true, state: "error", active: 0, intent, title: "This step was not saved", description: error.message || "Check the information and try again." });
    }
  }

  function validateCurrentStep() {
    if (step.id === "identity" && !draft.name.trim()) { toast("Enter the business or brand name.", { type: "error", title: "Business name required" }); return false; }
    if (step.id === "identity" && !draft.businessType) { toast("Choose the closest business type.", { type: "error", title: "Business type required" }); return false; }
    if (step.id === "operation" && !draft.operatingModel) { toast("Choose how this business operates.", { type: "error", title: "Operating model required" }); return false; }
    if (step.id === "location" && !(branchDraft.branchName || branchDraft.name)?.trim()) { toast("Give the location a short name.", { type: "error", title: "Location name required" }); return false; }
    if (step.id === "location" && !branchDraft.city) { toast("Choose the city or town for this location.", { type: "error", title: "City required" }); return false; }
    return true;
  }

  async function continueFlow() {
    if (!validateCurrentStep()) return;
    const finish = nextIndex < 0;
    await persist({ intent: finish ? "finish" : "continue" });
  }

  async function saveAndLeave() {
    if (!validateCurrentStep()) return;
    await persist({ intent: "leave" });
  }

  function afterTask() {
    const success = processing.state === "success";
    setProcessing((value) => ({ ...value, open: false }));
    if (!success) return;
    if (processing.intent === "leave" || processing.intent === "finish" || nextIndex < 0) router.push("/business");
    else setCurrent(nextIndex);
  }

  const content = step.id === "identity" ? <IdentityStep draft={draft} setDraft={setDraft} />
    : step.id === "operation" ? <OperationStep draft={draft} setDraft={setDraft} />
      : step.id === "location" ? <LocationStep branchDraft={branchDraft} setBranchDraft={setBranchDraft} operatingModel={draft.operatingModel} />
        : step.id === "offering" ? <OfferingStep draft={draft} setDraft={setDraft} />
          : step.id === "starter" ? <StarterStep templates={templates} selectedTemplateIds={selectedTemplateIds} setSelectedTemplateIds={setSelectedTemplateIds} archetype={archetype} />
            : <ReviewStep draft={draft} branchDraft={branchDraft} selectedTemplateIds={selectedTemplateIds} />;

  return <div className="space-y-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-business">Guided business setup</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Build the right workspace, step by step</h1></div><WorkspaceContextSwitcher showBranch={false} compact /></div><div className="rounded-3xl border bg-white p-4 shadow-card sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold">{step.label}</p><p className="mt-1 text-xs text-secondary">Step {visiblePosition + 1} of {activeSteps.length}</p></div><Badge tone="accent">{progress}%</Badge></div><ProgressBar value={progress} className="mt-4 h-2.5" /></div><div className="flex items-start gap-6"><StepRail steps={activeSteps} currentId={step.id} completed={completed} /><Card className="min-w-0 flex-1 overflow-hidden"><div className="p-6 sm:p-8 lg:p-10"><AnimatePresence mode="wait"><motion.div key={step.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>{content}</motion.div></AnimatePresence></div><div className="flex flex-col-reverse gap-3 border-t bg-grouped/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Button variant="ghost" disabled={previousIndex < 0} onClick={() => previousIndex >= 0 && setCurrent(previousIndex)}><ArrowLeft className="h-4 w-4" />Back</Button><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button variant="outline" onClick={saveAndLeave}>Save and leave</Button><Button onClick={continueFlow}>{nextIndex < 0 ? "Prepare my workspace" : "Save and continue"}<ArrowRight className="h-4 w-4" /></Button></div></div></Card></div><FullScreenTask open={processing.open} state={processing.state} title={processing.title} description={processing.description} steps={["Save the business structure", "Confirm the location", "Shape the operational workspace", "Finish"]} activeStep={processing.active} onDone={afterTask} doneLabel={processing.intent === "leave" ? "Return to business home" : nextIndex < 0 ? "Open workspace" : "Continue setup"} /></div>;
}
