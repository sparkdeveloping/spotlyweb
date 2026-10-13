"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CircleDollarSign, Download, Landmark, LoaderCircle, Plus, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { Badge, Button, Card, EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, FieldLabel, fieldClass, selectClass } from "@/components/business/shared";
import { paymentMethods } from "@/data/business-config";
import { authenticatedFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";

const emptyFinance = { acceptedCurrencies: ["USD"], paymentMethods: ["cash"], legalName: "", companyRegistrationNumber: "", taxNumber: "", responsiblePerson: "", registeredAddress: "" };
const emptySettlement = { bank: "", branch: "", accountHolder: "", accountNumber: "", currency: "USD", country: "Zimbabwe", proofStoragePath: "" };

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}
function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function ledgerLabel(type) {
  return ({ payment_captured: "Customer payment captured", platform_fee: "Spotly service fee", settlement_available: "Funds became available", refund: "Refund", payout_requested: "Payout requested", payout_processing: "Payout processing", payout_paid: "Payout paid", payout_cancelled: "Payout returned to available balance", adjustment: "Adjustment" })[type] || String(type || "Ledger entry").replaceAll("_", " ");
}

function SettlementModal({ open, onClose, current, businessId, onSaved }) {
  const [form, setForm] = useState(emptySettlement);
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (open) { setForm({ ...emptySettlement, bank: current?.bank || "", branch: current?.branch || "", accountHolder: current?.accountHolder || "", currency: current?.currency || "USD", country: current?.country || "Zimbabwe", accountNumber: "", proofStoragePath: current?.proofStoragePath || "" }); setProof(null); } }, [open, current]);
  const update = (values) => setForm((state) => ({ ...state, ...values }));
  async function submit(event) {
    event.preventDefault();
    if (!form.accountNumber.trim()) return toast("Enter the complete bank account number. Spotly stores it in restricted encrypted server data and only returns the last four digits.", { type: "error", title: "Account number required" });
    setSaving(true);
    try {
      let proofStoragePath = form.proofStoragePath || "";
      if (proof) {
        if (proof.size > 5 * 1024 * 1024) throw new Error("Settlement proof must be 5 MB or smaller.");
        const dataBase64 = await fileBase64(proof);
        const uploaded = await authenticatedFetch("/api/business/money", { method: "POST", body: JSON.stringify({ action: "upload_settlement_proof", businessId, fileName: proof.name, mimeType: proof.type, dataBase64 }) });
        proofStoragePath = uploaded.storagePath;
      }
      await authenticatedFetch("/api/business/money", { method: "POST", body: JSON.stringify({ action: "submit_settlement", businessId, bank: form.bank, branch: form.branch, accountHolder: form.accountHolder, accountNumber: form.accountNumber, currency: form.currency, country: form.country, proofStoragePath }) });
      toast("Settlement details were submitted for verification.", { title: "Settlement submitted" });
      onSaved(); onClose();
    } catch (error) { toast(error.message, { type: "error", title: "Could not submit settlement account" }); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title={current ? "Update settlement account" : "Set up settlement account"} description="For the controlled pilot, Spotly settles eligible merchant balances to a verified Zimbabwean bank account." size="lg"><form onSubmit={submit} className="space-y-5 p-5"><div className="rounded-xl border border-info/30 bg-info-soft p-4 text-sm leading-6 text-[var(--on-info-soft)]"><ShieldCheck className="mr-2 inline h-4 w-4" />The full account number is sent only to Spotly’s server and stored in restricted encrypted data. Business screens display only the final four digits.</div><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Bank" required><input required className={fieldClass} value={form.bank} onChange={(event) => update({ bank: event.target.value })} /></FieldLabel><FieldLabel label="Bank branch"><input className={fieldClass} value={form.branch} onChange={(event) => update({ branch: event.target.value })} /></FieldLabel><FieldLabel label="Account holder" required><input required className={fieldClass} value={form.accountHolder} onChange={(event) => update({ accountHolder: event.target.value })} /></FieldLabel><FieldLabel label="Account number" required hint={current?.accountNumberLast4 ? `Current account ends in ${current.accountNumberLast4}. Enter the full number to replace or resubmit it.` : "Never shown back in full after submission."}><input required autoComplete="off" inputMode="numeric" className={fieldClass} value={form.accountNumber} onChange={(event) => update({ accountNumber: event.target.value })} /></FieldLabel><FieldLabel label="Settlement currency"><select className={selectClass} value={form.currency} onChange={(event) => update({ currency: event.target.value })}><option value="USD">USD</option><option value="ZWG">ZiG</option></select></FieldLabel><FieldLabel label="Proof of account" hint="Optional bank confirmation, statement header, or other proof requested by Spotly."><input className={fieldClass} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setProof(event.target.files?.[0] || null)} /></FieldLabel></div><div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Submit for verification</Button></div></form></Modal>;
}

function PayoutModal({ open, onClose, businessId, balances, currencies, onSaved }) {
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const available = Number(balances?.[currency]?.available || 0);
  useEffect(() => { if (open) { const next = currencies?.[0] || "USD"; setCurrency(next); setAmount(Number(balances?.[next]?.available || 0) > 0 ? Number(balances[next].available).toFixed(2) : ""); } }, [open, currencies, balances]);
  async function submit(event) {
    event.preventDefault();
    const numeric = Number(amount);
    if (!numeric || numeric <= 0 || numeric > available + 0.001) return toast("Enter an amount within the settled balance currently available.", { type: "error", title: "Review payout amount" });
    setSaving(true);
    try { await authenticatedFetch("/api/business/money", { method: "POST", body: JSON.stringify({ action: "request_payout", businessId, currency, amount: numeric }) }); toast("The payout was reserved from your available balance and sent to Spotly Finance.", { title: "Payout requested" }); onSaved(); onClose(); }
    catch (error) { toast(error.message, { type: "error", title: "Payout could not be requested" }); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Request payout" description="Only settled funds shown as Available can be requested." size="sm"><form onSubmit={submit} className="space-y-5 p-5"><div className="rounded-xl bg-grouped p-4"><p className="text-sm text-secondary">Available in {currency}</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(available, currency)}</p></div><div className="grid gap-4 sm:grid-cols-[1fr_110px]"><FieldLabel label="Amount"><input required type="number" min="0.01" max={available || undefined} step="0.01" className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} /></FieldLabel><FieldLabel label="Currency"><select className={selectClass} value={currency} onChange={(event) => { const next = event.target.value; setCurrency(next); setAmount(Number(balances?.[next]?.available || 0).toFixed(2)); }}>{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></FieldLabel></div><div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" loading={saving} disabled={available <= 0}>Request</Button></div></form></Modal>;
}

export function FinanceView() {
  const { business, selectedBusinessId, lifecycle } = useBusinessWorkspace();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finance, setFinance] = useState(emptyFinance);
  const [currency, setCurrency] = useState("USD");
  const [tab, setTab] = useState("overview");
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!selectedBusinessId) return;
    setLoading(true); setError("");
    try { const result = await authenticatedFetch(`/api/business/money?businessId=${encodeURIComponent(selectedBusinessId)}`); setData(result); setFinance({ ...emptyFinance, ...(result.finance || {}) }); const currencies = result.finance?.acceptedCurrencies?.length ? result.finance.acceptedCurrencies : result.policy?.supportedCurrencies || ["USD"]; if (!currencies.includes(currency)) setCurrency(currencies[0]); }
    catch (caught) { setError(caught.message || "Money data could not be loaded."); }
    finally { setLoading(false); }
  }, [currency, selectedBusinessId]);
  useEffect(() => { load(); }, [load]);
  const currencies = finance.acceptedCurrencies?.length ? finance.acceptedCurrencies : data?.policy?.supportedCurrencies || ["USD"];
  const balance = data?.balances?.[currency] || { pending: 0, available: 0, reserved: 0, payoutProcessing: 0, paidOut: 0, liability: 0 };
  const availableMethods = useMemo(() => paymentMethods.filter((method) => data?.policy?.supportedPaymentMethods?.includes(method.id)), [data]);
  function toggleCurrency(value) { setFinance((current) => ({ ...current, acceptedCurrencies: current.acceptedCurrencies.includes(value) ? current.acceptedCurrencies.filter((item) => item !== value) : [...current.acceptedCurrencies, value] })); }
  function toggleMethod(value) { setFinance((current) => ({ ...current, paymentMethods: current.paymentMethods.includes(value) ? current.paymentMethods.filter((item) => item !== value) : [...current.paymentMethods, value] })); }
  async function saveSettings() {
    if (!finance.acceptedCurrencies.length || !finance.paymentMethods.length) return toast("Select at least one supported currency and payment method.", { type: "error", title: "Payment setup incomplete" });
    setSaving(true);
    try { await authenticatedFetch("/api/business/money", { method: "POST", body: JSON.stringify({ action: "customer_settings", businessId: selectedBusinessId, acceptedCurrencies: finance.acceptedCurrencies, paymentMethods: finance.paymentMethods, legalName: finance.legalName || "", companyRegistrationNumber: finance.companyRegistrationNumber || "", taxNumber: finance.taxNumber || "", responsiblePerson: finance.responsiblePerson || "", registeredAddress: finance.registeredAddress || "" }) }); toast("Business payment settings saved.", { title: "Money settings updated" }); await load(); }
    catch (caught) { toast(caught.message, { type: "error", title: "Could not save Money settings" }); }
    finally { setSaving(false); }
  }
  function exportStatement() {
    const rows = [["Date", "Type", "Currency", "Amount", "Direction", "Reference"], ...(data?.ledger || []).map((item) => [item.createdAt || "", ledgerLabel(item.type), item.currency || "USD", Number(item.amount || 0).toFixed(2), item.direction || "", item.reference || ""])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${business?.name || "spotly"}-money-statement.csv`.replace(/\s+/g, "-").toLowerCase(); link.click(); URL.revokeObjectURL(url);
  }
  const tabs = [{ value: "overview", label: "Overview" }, { value: "activity", label: "Activity" }, { value: "payouts", label: "Payouts" }, { value: "settings", label: "Payment setup" }];

  if (loading && !data) return <div className="space-y-6"><PageHeader title="Money" description="Payments, settlement, payouts and statements." actions={<BusinessSwitcher />} /><Card className="flex justify-center p-16"><LoaderCircle className="h-7 w-7 animate-spin text-business" /></Card></div>;
  if (error && !data) return <div className="space-y-6"><PageHeader title="Money" description="Payments, settlement, payouts and statements." actions={<BusinessSwitcher />} /><EmptyState icon={Banknote} title="Money could not be loaded" description={error} action={<Button onClick={load}>Try again</Button>} /></div>;

  return <div className="space-y-6"><PageHeader title="Money" description="A server-authoritative view of customer payments, merchant settlement and payouts." actions={<BusinessSwitcher />} />{lifecycle?.businessState !== "live" && <Card variant="bordered" className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">Money is one part of launch preparation</p><p className="mt-1 max-w-3xl text-sm leading-6 text-secondary">Settlement verification only checks where Spotly can send eligible business funds. It is separate from your business-access approval and separate from the final Spotly launch review.</p></div><Badge tone={lifecycle?.launchChecks?.find((item) => item.id === "settlement")?.state === "in_review" ? "accent" : "neutral"}>{lifecycle?.launchChecks?.find((item) => item.id === "settlement")?.ownerLabel || "Launch preparation"}</Badge></div></Card>}<div className="flex flex-wrap items-center justify-between gap-3"><Tabs idPrefix="business-money" value={tab} onChange={setTab} tabs={tabs} /><select className={`${selectClass} w-auto min-w-[120px]`} value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Money currency">{currencies.map((item) => <option key={item}>{item}</option>)}</select></div>
    {tab === "overview" && <div className="space-y-6"><div className="metric-grid"><MetricCard label="Available" value={formatCurrency(balance.available, currency)} hint="Settled and eligible for payout" icon={Banknote} tone={balance.available > 0 ? "success" : "default"} /><MetricCard label="Pending settlement" value={formatCurrency(balance.pending, currency)} hint="Captured but not yet reconciled as available" icon={CircleDollarSign} /><MetricCard label="Reserved" value={formatCurrency(balance.reserved + balance.payoutProcessing, currency)} hint="Payouts or other holds" icon={WalletCards} /><MetricCard label="Paid out" value={formatCurrency(balance.paidOut, currency)} hint="Completed payouts recorded by Spotly" icon={ReceiptText} /></div>{balance.liability > 0 && <div role="alert" className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-[var(--on-warning-soft)]">This business has a {formatCurrency(balance.liability, currency)} settlement liability after refunds or adjustments. New payouts remain blocked until reconciliation clears it.</div>}<div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Settlement account" description="Customer payments are distinct from the bank account Spotly uses for merchant settlement."><div className="p-5">{data?.settlement ? <div className="space-y-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{data.settlement.bank}</p><p className="mt-1 text-sm text-secondary">{data.settlement.accountHolder} · •••• {data.settlement.accountNumberLast4 || "—"} · {data.settlement.currency}</p></div><StatusBadge status={data.settlement.status} /></div>{data.settlement.rejectionReason && <p className="rounded-xl bg-warning-soft p-3 text-sm text-[var(--on-warning-soft)]">{data.settlement.rejectionReason}</p>}<Button variant="outline" onClick={() => setSettlementOpen(true)}>Update settlement details</Button></div> : <EmptyState icon={Landmark} title="Settlement account not configured" description="Submit a bank account for Spotly verification before requesting payouts." action={<Button onClick={() => setSettlementOpen(true)}>Set up settlement account</Button>} />}</div></SectionCard><SectionCard title="Payout policy" description="Spotly shows the actual platform policy; businesses cannot select payout schedules or rails that are not operational."><div className="space-y-4 p-5"><div className="rounded-xl bg-grouped p-4"><p className="text-sm font-semibold">Controlled pilot: platform settlement</p><p className="mt-2 text-sm leading-6 text-secondary">Customer checkout is processed through Spotly’s configured payment rails. Merchant balances become Available only after Spotly Finance reconciles the captured order.</p></div><div><p className="text-sm text-secondary">Processing policy</p><p className="mt-1 font-semibold">{data?.policy?.payoutPolicyLabel || "Processed manually during the controlled pilot"}</p></div><Button onClick={() => setPayoutOpen(true)} disabled={data?.settlement?.status !== "verified" || balance.available <= 0}><Plus className="h-4 w-4" />Request payout</Button></div></SectionCard></div></div>}
    {tab === "activity" && <SectionCard title="Money activity" description="Ledger entries are server-authored. Financial corrections appear as new entries instead of rewriting history.">{data?.ledger?.length ? <div className="divide-y">{data.ledger.map((item) => <div key={item.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{ledgerLabel(item.type)}</p><p className="mt-1 text-xs text-secondary">{displayDate(item.createdAt)}{item.reference ? ` · ${item.reference}` : ""}</p></div><div className="text-left sm:text-right"><p className={`font-semibold ${item.direction === "debit" ? "text-danger" : item.direction === "credit" ? "text-success" : ""}`}>{item.direction === "debit" ? "−" : item.direction === "credit" ? "+" : ""}{formatCurrency(item.amount, item.currency)}</p><Badge tone="neutral">{item.currency}</Badge></div></div>)}</div> : <EmptyState icon={ReceiptText} title="No ledger activity yet" description="Captured customer payments, fees, refunds, adjustments and payouts will appear here." />}</SectionCard>}
    {tab === "payouts" && <div className="space-y-5"><div className="flex justify-end gap-2"><Button variant="outline" onClick={exportStatement}><Download className="h-4 w-4" />Export statement CSV</Button><Button onClick={() => setPayoutOpen(true)} disabled={data?.settlement?.status !== "verified" || balance.available <= 0}><Plus className="h-4 w-4" />Request payout</Button></div><SectionCard title="Payout history" description="Each request is reserved against the server balance so the same funds cannot be requested twice.">{data?.payouts?.length ? <div className="divide-y">{data.payouts.map((item) => <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{formatCurrency(item.amount, item.currency)}</p><p className="mt-1 text-xs text-secondary">Requested {displayDate(item.createdAt)} · settlement account •••• {item.settlementAccountLast4 || "—"}</p>{item.reference && <p className="mt-1 text-xs text-secondary">Reference {item.reference}</p>}</div><StatusBadge status={item.status || "requested"} /></div>)}</div> : <EmptyState icon={WalletCards} title="No payout requests" description="Payouts will appear here after a verified settlement account has an Available balance." />}</SectionCard></div>}
    {tab === "settings" && <div className="grid gap-5 xl:grid-cols-2"><SectionCard title="Customer payment methods" description="These are ways customers can pay Spotly for this business. They are not merchant payout destinations."><div className="space-y-5 p-5"><div><p className="text-sm font-semibold">Currencies</p><div className="mt-3 flex flex-wrap gap-2">{(data?.policy?.supportedCurrencies || ["USD"]).map((item) => <button key={item} type="button" onClick={() => toggleCurrency(item)} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${finance.acceptedCurrencies.includes(item) ? "border-business bg-business-soft text-business" : "bg-[var(--surface)]"}`}>{finance.acceptedCurrencies.includes(item) && <CheckCircle2 className="mr-2 inline h-4 w-4" />}{item}</button>)}</div></div><div><p className="text-sm font-semibold">Payment methods enabled by Spotly</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{availableMethods.map((method) => <button key={method.id} type="button" onClick={() => toggleMethod(method.id)} className={`rounded-xl border p-4 text-left ${finance.paymentMethods.includes(method.id) ? "border-business bg-business-soft" : "bg-[var(--surface)]"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{method.label}</span>{finance.paymentMethods.includes(method.id) && <Badge tone="success">On</Badge>}</div><p className="mt-2 text-xs leading-5 text-secondary">{method.description}</p></button>)}</div></div><Button onClick={saveSettings} loading={saving}>Save customer payment methods</Button></div></SectionCard><SectionCard title="Business identity for settlement" description="Keep confirmed legal and responsible-person details attached to the Money setup."><div className="grid gap-4 p-5"><FieldLabel label="Legal business name"><input className={fieldClass} value={finance.legalName || ""} onChange={(event) => setFinance({ ...finance, legalName: event.target.value })} /></FieldLabel><FieldLabel label="Company registration number"><input className={fieldClass} value={finance.companyRegistrationNumber || ""} onChange={(event) => setFinance({ ...finance, companyRegistrationNumber: event.target.value })} /></FieldLabel><FieldLabel label="Tax number"><input className={fieldClass} value={finance.taxNumber || ""} onChange={(event) => setFinance({ ...finance, taxNumber: event.target.value })} /></FieldLabel><FieldLabel label="Responsible person"><input className={fieldClass} value={finance.responsiblePerson || ""} onChange={(event) => setFinance({ ...finance, responsiblePerson: event.target.value })} /></FieldLabel><FieldLabel label="Registered business address"><input className={fieldClass} value={finance.registeredAddress || ""} onChange={(event) => setFinance({ ...finance, registeredAddress: event.target.value })} /></FieldLabel><Button onClick={saveSettings} loading={saving}>Save business records</Button></div></SectionCard></div>}
    <SettlementModal open={settlementOpen} onClose={() => setSettlementOpen(false)} current={data?.settlement} businessId={selectedBusinessId} onSaved={load} /><PayoutModal open={payoutOpen} onClose={() => setPayoutOpen(false)} businessId={selectedBusinessId} balances={data?.balances || {}} currencies={currencies} onSaved={load} />
  </div>;
}
