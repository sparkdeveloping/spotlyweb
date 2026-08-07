"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CircleDollarSign, CreditCard, Landmark, Plus, ReceiptText, Smartphone, WalletCards } from "lucide-react";
import { Badge, Button, Card, EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, FieldLabel, FullScreenTask, fieldClass, selectClass } from "@/components/business/shared";
import { paymentMethods } from "@/data/business-config";
import { saveBusinessFinanceSettings } from "@/lib/firebase-services";
import { requestPayout } from "@/lib/business-services";
import { formatCurrency } from "@/lib/format";

const defaults = {
  acceptedCurrencies: ["USD", "ZWG"], paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"], paymentRecipient: "platform",
  payoutCadence: "weekly", payoutMethod: "bank_transfer", bankName: "", accountName: "", accountNumberMasked: "", bankBranch: "", mobileMoneyProvider: "ecocash", mobileMoneyNumber: "",
  taxNumber: "", legalName: "", companyRegistrationNumber: "", fiscalInvoiceEnabled: false, invoicePrefix: "SPT", settlementReservePercent: 0, payoutMinimum: 0
};

const completedStatuses = {
  grocery_retail: ["completed", "picked_up"], restaurant_food: ["completed", "picked_up"], ticketing_events: ["issued", "checked_in", "completed"],
  appointments_services: ["completed"], accommodation_activities: ["completed", "checked_out"], directory_profile: ["resolved", "completed"]
};

function PayoutModal({ open, onClose, available }) {
  const { business, user, finance } = useBusinessWorkspace();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (open) { setAmount(available > 0 ? String(available.toFixed(2)) : ""); setCurrency(finance?.acceptedCurrencies?.[0] || "USD"); } }, [open, available, finance]);
  async function submit(event) {
    event.preventDefault();
    if (!Number(amount) || Number(amount) <= 0) return toast("Enter a payout amount greater than zero.", { type: "error", title: "Amount required" });
    setSaving(true);
    try { await requestPayout(business.id, amount, currency, user); toast("The payout request has been sent for review.", { title: "Payout requested" }); onClose(); }
    catch (error) { toast(error.message || "The payout could not be requested.", { type: "error", title: "Could not request payout" }); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Request a payout" size="sm"><form onSubmit={submit} className="space-y-5 p-5"><div className="rounded-2xl bg-grouped p-4"><p className="text-sm text-secondary">Estimated available balance</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(available, currency)}</p><p className="mt-2 text-xs leading-5 text-secondary">Spotly verifies completed activity, refunds, fees, and settlement holds before approval.</p></div><div className="grid gap-4 sm:grid-cols-[1fr_120px]"><FieldLabel label="Amount" required><input type="number" min="0.01" step="0.01" className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} /></FieldLabel><FieldLabel label="Currency"><select className={selectClass} value={currency} onChange={(event) => setCurrency(event.target.value)}>{(finance?.acceptedCurrencies || ["USD", "ZWG"]).map((item) => <option key={item}>{item}</option>)}</select></FieldLabel></div><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" loading={saving}>Request payout</Button></div></form></Modal>;
}

export function FinanceView() {
  const { business, finance, payouts, orders, user, archetype } = useBusinessWorkspace();
  const [form, setForm] = useState(defaults);
  const [step, setStep] = useState("customer");
  const [saving, setSaving] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [task, setTask] = useState({ open: false, state: "processing", title: "", description: "", active: 0 });
  const { toast } = useToast();
  useEffect(() => setForm({ ...defaults, ...(finance || {}) }), [finance]);

  const statuses = completedStatuses[archetype.id] || completedStatuses.directory_profile;
  const totals = useMemo(() => {
    const completed = orders.filter((item) => statuses.includes(item.status));
    const gross = completed.reduce((sum, item) => sum + Number(item.totals?.total ?? item.total ?? item.amount ?? 0), 0);
    const fees = completed.reduce((sum, item) => sum + Number(item.platformFee || item.fees?.platform || 0), 0);
    const refunded = orders.reduce((sum, item) => sum + Number(item.refundedAmount || 0), 0);
    const requested = payouts.filter((item) => ["requested", "reviewing", "approved", "processing"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { completed: completed.length, gross, fees, refunded, requested, available: Math.max(0, gross - fees - refunded - requested) };
  }, [orders, payouts, statuses]);

  function toggleCurrency(value) {
    setForm((current) => ({ ...current, acceptedCurrencies: current.acceptedCurrencies.includes(value) ? current.acceptedCurrencies.filter((item) => item !== value) : [...current.acceptedCurrencies, value] }));
  }
  function toggleMethod(value) {
    setForm((current) => ({ ...current, paymentMethods: current.paymentMethods.includes(value) ? current.paymentMethods.filter((item) => item !== value) : [...current.paymentMethods, value] }));
  }
  async function save() {
    if (!form.acceptedCurrencies.length) return toast("Select at least one accepted currency.", { type: "error", title: "Currency required" });
    if (!form.paymentMethods.length) return toast("Select at least one payment method.", { type: "error", title: "Payment method required" });
    setSaving(true);
    setTask({ open: true, state: "processing", title: "Saving payment settings", description: "Spotly is checking customer methods, settlement routing, and business records.", active: 1 });
    try {
      await saveBusinessFinanceSettings(business.id, form, user);
      setTask({ open: true, state: "success", title: "Payment settings saved", description: "The business now has one consistent payment and settlement configuration.", active: 4 });
    } catch (error) {
      setTask({ open: true, state: "error", title: "Payment settings were not saved", description: error.message || "Review the details and try again.", active: 1 });
    } finally { setSaving(false); }
  }

  const currency = form.acceptedCurrencies[0] || "USD";
  const stepTabs = [{ value: "customer", label: "1. Customer payments" }, { value: "settlement", label: "2. Where money goes" }, { value: "records", label: "3. Business records" }];

  return <div className="space-y-6">
    <PageHeader title="Payments" description="Set this up in three clear steps. Start with what customers can use, then decide where funds are settled." actions={<BusinessSwitcher />} />
    <div className="metric-grid"><MetricCard label="Completed value" value={formatCurrency(totals.gross, currency)} hint={`${totals.completed} completed ${archetype.nouns.activity}`} icon={CircleDollarSign} /><MetricCard label="Platform fees" value={formatCurrency(totals.fees, currency)} hint="Recorded against completed transactions" icon={ReceiptText} /><MetricCard label="Requested payouts" value={formatCurrency(totals.requested, currency)} hint="Awaiting review or processing" icon={WalletCards} /><MetricCard label="Estimated available" value={formatCurrency(totals.available, currency)} hint="Before final reconciliation" icon={Banknote} tone={totals.available > 0 ? "success" : "default"} /></div>

    <Card className="p-3 sm:p-4"><Tabs value={step} onChange={setStep} tabs={stepTabs} /></Card>

    {step === "customer" && <SectionCard title="What customers can use" description="Select only the methods this business can reliably accept today. You can add more later."><div className="space-y-7 p-5"><div><p className="text-sm font-semibold">Accepted currencies</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{[{ id: "USD", label: "United States dollar", detail: "US$" }, { id: "ZWG", label: "Zimbabwe Gold (ZiG)", detail: "ZiG" }].map((item) => <button key={item.id} type="button" onClick={() => toggleCurrency(item.id)} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${form.acceptedCurrencies.includes(item.id) ? "border-business bg-business-soft" : "hover:bg-grouped"}`}><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)] font-semibold shadow-sm">{item.detail}</span><span className="flex-1"><span className="block font-semibold">{item.label}</span><span className="mt-1 block text-xs text-secondary">{form.acceptedCurrencies.includes(item.id) ? "Customers can pay in this currency" : "Not offered"}</span></span>{form.acceptedCurrencies.includes(item.id) && <Badge tone="success"><CheckCircle2 className="h-3 w-3" />Selected</Badge>}</button>)}</div></div><div><p className="text-sm font-semibold">Payment methods</p><p className="mt-1 text-xs leading-5 text-secondary">Cash and manual methods can work immediately. Online methods still require their provider configuration in Spotly Admin.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{paymentMethods.map((method) => <button key={method.id} type="button" onClick={() => toggleMethod(method.id)} className={`rounded-2xl border p-4 text-left transition ${form.paymentMethods.includes(method.id) ? "border-business bg-business-soft" : "hover:bg-grouped"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{method.label}</span>{form.paymentMethods.includes(method.id) && <Badge tone="success">On</Badge>}</div><p className="mt-2 text-xs leading-5 text-secondary">{method.description}</p></button>)}</div></div><div className="flex justify-end border-t pt-5"><Button onClick={() => setStep("settlement")}>Continue to settlement</Button></div></div></SectionCard>}

    {step === "settlement" && <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]"><SectionCard title="Who receives customer payments?" description="This is a business-level rule. Spotly Admin can also set platform defaults."><div className="space-y-5 p-5"><FieldLabel label="Payment recipient"><select className={selectClass} value={form.paymentRecipient} onChange={(event) => setForm({ ...form, paymentRecipient: event.target.value })}><option value="platform">Spotly collects and settles to the business</option><option value="business">The business receives payment directly</option><option value="hybrid">Depends on payment method</option></select></FieldLabel><div className="rounded-2xl bg-grouped p-4 text-sm leading-6 text-secondary">{form.paymentRecipient === "platform" ? "Spotly records the customer payment, applicable fees, and the amount due to the business before payout." : form.paymentRecipient === "business" ? "The business receives payment through its own channel. Spotly still records the transaction state for the customer and business." : "Each method can follow a different route. This is useful while the platform transitions between direct and centrally settled payments."}</div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Payout schedule"><select className={selectClass} value={form.payoutCadence} onChange={(event) => setForm({ ...form, payoutCadence: event.target.value })}><option value="daily">Daily</option><option value="twice_weekly">Twice weekly</option><option value="weekly">Weekly</option><option value="fortnightly">Every two weeks</option><option value="monthly">Monthly</option><option value="manual">Manual request</option></select></FieldLabel><FieldLabel label="Payout destination"><select className={selectClass} value={form.payoutMethod} onChange={(event) => setForm({ ...form, payoutMethod: event.target.value })}><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="manual">Arrange manually</option></select></FieldLabel></div>{form.payoutMethod === "bank_transfer" && <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Bank"><input className={fieldClass} value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></FieldLabel><FieldLabel label="Bank branch"><input className={fieldClass} value={form.bankBranch} onChange={(event) => setForm({ ...form, bankBranch: event.target.value })} /></FieldLabel><FieldLabel label="Account name"><input className={fieldClass} value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} /></FieldLabel><FieldLabel label="Account number"><input className={fieldClass} value={form.accountNumberMasked} onChange={(event) => setForm({ ...form, accountNumberMasked: event.target.value })} /></FieldLabel></div>}{form.payoutMethod === "mobile_money" && <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Provider"><select className={selectClass} value={form.mobileMoneyProvider} onChange={(event) => setForm({ ...form, mobileMoneyProvider: event.target.value })}><option value="ecocash">EcoCash</option><option value="onemoney">OneMoney</option></select></FieldLabel><FieldLabel label="Mobile money number"><input className={fieldClass} value={form.mobileMoneyNumber} onChange={(event) => setForm({ ...form, mobileMoneyNumber: event.target.value })} placeholder="+263..." /></FieldLabel></div>}<div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Minimum payout"><input type="number" min="0" className={fieldClass} value={form.payoutMinimum} onChange={(event) => setForm({ ...form, payoutMinimum: event.target.value })} /></FieldLabel><FieldLabel label="Settlement reserve %"><input type="number" min="0" max="100" className={fieldClass} value={form.settlementReservePercent} onChange={(event) => setForm({ ...form, settlementReservePercent: event.target.value })} /></FieldLabel></div><div className="flex justify-end border-t pt-5"><Button onClick={() => setStep("records")}>Continue to business records</Button></div></div></SectionCard><div className="space-y-5"><SectionCard title="Payout history" description="Every request remains visible from request to completion.">{payouts.length ? <div className="divide-y">{payouts.map((item) => <div key={item.id} className="flex items-center gap-4 p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grouped text-secondary">{form.payoutMethod === "mobile_money" ? <Smartphone className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-semibold">{formatCurrency(item.amount, item.currency)}</p><p className="mt-1 text-xs text-secondary">Requested {item.createdAt?.toDate?.().toLocaleDateString() || "recently"}</p></div><StatusBadge status={item.status || "requested"} /></div>)}</div> : <EmptyState icon={CreditCard} title="No payout records yet" description="Payout requests and completed settlements will appear here." />}</SectionCard><Button className="w-full" variant="outline" onClick={() => setPayoutOpen(true)} disabled={totals.available <= 0}><Plus className="h-4 w-4" />Request payout</Button></div></div>}

    {step === "records" && <SectionCard title="Legal, tax, and invoice information" description="Leave fields blank until the business has confirmed them. Nothing here should be guessed."><div className="grid gap-4 p-5 sm:grid-cols-2"><FieldLabel label="Legal business name"><input className={fieldClass} value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></FieldLabel><FieldLabel label="Company registration number"><input className={fieldClass} value={form.companyRegistrationNumber} onChange={(event) => setForm({ ...form, companyRegistrationNumber: event.target.value })} /></FieldLabel><FieldLabel label="Tax identification number"><input className={fieldClass} value={form.taxNumber} onChange={(event) => setForm({ ...form, taxNumber: event.target.value })} /></FieldLabel><FieldLabel label="Invoice prefix"><input className={fieldClass} value={form.invoicePrefix} onChange={(event) => setForm({ ...form, invoicePrefix: event.target.value.toUpperCase().slice(0, 8) })} /></FieldLabel><label className="flex items-start gap-3 rounded-2xl bg-grouped p-4 sm:col-span-2"><input className="mt-1" type="checkbox" checked={form.fiscalInvoiceEnabled} onChange={(event) => setForm({ ...form, fiscalInvoiceEnabled: event.target.checked })} /><span><span className="block text-sm font-semibold">These details have been verified by the business</span><span className="mt-1 block text-xs leading-5 text-secondary">Enable only after the responsible person confirms the information required for the business&apos;s invoicing and tax process.</span></span></label><div className="flex justify-end border-t pt-5 sm:col-span-2"><Button onClick={save} loading={saving}>Save all payment settings</Button></div></div></SectionCard>}

    <PayoutModal open={payoutOpen} onClose={() => setPayoutOpen(false)} available={totals.available} />
    <FullScreenTask open={task.open} state={task.state} title={task.title} description={task.description} steps={["Validate customer methods", "Save settlement routing", "Update business records", "Finish"]} activeStep={task.active} onDone={() => setTask((current) => ({ ...current, open: false }))} doneLabel="Return to payments" />
  </div>;
}
