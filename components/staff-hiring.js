"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleAlert, ExternalLink, FileText,
  Globe2, Mail, MapPin, MessageSquareText, Pause, Play, Plus, RefreshCw, Search, UserCheck, UserPlus, UsersRound, XCircle
} from "lucide-react";
import { StaffInvitations } from "@/components/staff-invitations";
import { authenticatedFetch } from "@/lib/api-client";
import { CAREER_STAGE_LABELS, CAREER_STAGES } from "@/data/careers";
import { STAFF_DEPARTMENTS, STAFF_ROLE_PACKS } from "@/data/staff";
import { spotlyPortalUrl } from "@/lib/spotly-domains";
import { Badge, Button, Card, EmptyState, EntityPicker, Modal, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";

const inputClass = "field-control w-full";
const areaClass = "field-control min-h-28 w-full resize-y";
const ACTIVE_STAGES = ["new", "screening", "interview", "reference_check", "offer"];

function dateLabel(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" });
}

function StageBadge({ stage }) {
  const tone = stage === "hired" ? "success" : stage === "rejected" || stage === "withdrawn" ? "neutral" : stage === "offer" ? "accent" : stage === "interview" ? "info" : "warning";
  return <Badge tone={tone}>{CAREER_STAGE_LABELS[stage] || stage}</Badge>;
}

function Metric({ label, value, detail, icon: Icon }) {
  return <Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span><div><p className="text-2xl font-bold tracking-[-.03em]">{value}</p><p className="mt-1 text-sm font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-secondary">{detail}</p></div></div></Card>;
}

function RoleEditor({ open, onClose, role, onSaved }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  useEffect(() => {
    if (!open) return;
    setForm({
      id: role?.id || undefined,
      title: role?.title || "",
      department: role?.department || STAFF_DEPARTMENTS[0],
      location: role?.location || "Harare, Zimbabwe",
      arrangement: role?.arrangement || "Hybrid",
      employmentType: role?.employmentType || "Full-time",
      rolePackId: role?.rolePackId || "",
      summary: role?.summary || "",
      description: role?.description || "",
      responsibilities: (role?.responsibilities || []).join("\n"),
      requirements: (role?.requirements || []).join("\n"),
      niceToHave: (role?.niceToHave || []).join("\n"),
      featured: Boolean(role?.featured),
      status: role?.status || "published"
    });
  }, [open, role]);
  const patch = (values) => setForm((current) => ({ ...current, ...values }));
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      await authenticatedFetch("/api/staff/hiring", { method: "POST", body: JSON.stringify({
        action: "save_job", ...form,
        responsibilities: form.responsibilities.split("\n").map((item) => item.trim()).filter(Boolean),
        requirements: form.requirements.split("\n").map((item) => item.trim()).filter(Boolean),
        niceToHave: form.niceToHave.split("\n").map((item) => item.trim()).filter(Boolean)
      }) });
      toast(role ? "Role updated." : "Role published to Careers.", { type: "success" });
      onClose(); onSaved();
    } catch (error) { toast(error.message, { type: "error", title: "Role could not be saved" }); }
    finally { setBusy(false); }
  }
  const departmentOptions = STAFF_DEPARTMENTS.map((item) => ({ value: item, label: item }));
  const rolePackOptions = [{ value: "", label: "Choose during onboarding", description: "No automatic internal role suggestion" }, ...Object.values(STAFF_ROLE_PACKS).map((item) => ({ value: item.id, label: item.name, description: item.department }))];
  return <Modal open={open} onClose={onClose} title={role ? `Edit ${role.title}` : "Create an open role"} size="xl"><form onSubmit={submit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Role title"><input required minLength={3} value={form.title || ""} onChange={(event)=>patch({title:event.target.value})} className={inputClass}/></Field><Field label="Department"><EntityPicker value={form.department || ""} onChange={(value)=>patch({department:value})} options={departmentOptions} title="Department" /></Field><Field label="Location"><input required value={form.location || ""} onChange={(event)=>patch({location:event.target.value})} className={inputClass}/></Field><Field label="Work arrangement"><input required value={form.arrangement || ""} onChange={(event)=>patch({arrangement:event.target.value})} className={inputClass}/></Field><Field label="Employment type"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{["Full-time","Part-time","Contract","Internship","Temporary"].map((value)=><button key={value} type="button" onClick={()=>patch({employmentType:value})} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${form.employmentType===value?"border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]":"hover:bg-grouped"}`}>{value}</button>)}</div></Field><Field label="Internal role pack"><EntityPicker value={form.rolePackId || ""} onChange={(value)=>patch({rolePackId:value})} options={rolePackOptions} title="Internal role pack" /></Field><Field wide label="Short summary"><textarea required minLength={20} value={form.summary || ""} onChange={(event)=>patch({summary:event.target.value})} className={areaClass}/></Field><Field wide label="Role description"><textarea required minLength={40} value={form.description || ""} onChange={(event)=>patch({description:event.target.value})} className={areaClass}/></Field><Field wide label="Responsibilities"><textarea required value={form.responsibilities || ""} onChange={(event)=>patch({responsibilities:event.target.value})} className={areaClass} placeholder="One responsibility per line" /></Field><Field wide label="Requirements"><textarea required value={form.requirements || ""} onChange={(event)=>patch({requirements:event.target.value})} className={areaClass} placeholder="One requirement per line" /></Field><Field wide label="Useful, not required" optional><textarea value={form.niceToHave || ""} onChange={(event)=>patch({niceToHave:event.target.value})} className={areaClass} placeholder="One item per line" /></Field><div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-grouped p-4"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.featured)} onChange={(event)=>patch({featured:event.target.checked})}/>Feature this role on Careers</label><div className="flex gap-2">{["draft","published","paused","closed"].map((value)=><button key={value} type="button" onClick={()=>patch({status:value})} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${form.status===value?"bg-[var(--accent)] text-[var(--on-accent)]":"border bg-[var(--surface)]"}`}>{value}</button>)}</div></div></div><div className="flex justify-end gap-2 border-t p-4"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{role ? "Save role" : "Publish role"}</Button></div></form></Modal>;
}

function CandidateDetail({ candidate, onClose, onChanged, onStartOnboarding }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [interview, setInterview] = useState({ scheduledFor: "", format: "video", note: "" });
  const [message, setMessage] = useState({ subject: "", body: "" });
  if (!candidate) return null;

  async function action(payload, key = payload.action) {
    setBusy(key);
    try {
      await authenticatedFetch("/api/staff/hiring", { method: "POST", body: JSON.stringify(payload) });
      toast("Hiring record updated.", { type: "success" });
      setNote("");
      await onChanged();
    } catch (error) {
      toast(error.message, { type: "error", title: "Hiring update failed" });
    } finally { setBusy(""); }
  }

  async function openCv() {
    setBusy("cv");
    try {
      const result = await authenticatedFetch("/api/staff/hiring", { method: "POST", body: JSON.stringify({ action: "cv_link", applicationId: candidate.id }) });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) { toast(error.message, { type: "error", title: "CV could not open" }); }
    finally { setBusy(""); }
  }

  async function sendMessage() {
    if (!message.subject.trim() || message.body.trim().length < 10) return;
    setBusy("candidate_message");
    try {
      await authenticatedFetch("/api/staff/hiring", { method: "POST", body: JSON.stringify({ action: "candidate_message", applicationId: candidate.id, subject: message.subject.trim(), message: message.body.trim() }) });
      toast("Email sent and added to the candidate history.", { type: "success", title: "Candidate contacted" });
      setMessage({ subject: "", body: "" });
      await onChanged();
    } catch (error) { toast(error.message, { type: "error", title: "Candidate email could not be sent" }); }
    finally { setBusy(""); }
  }

  return <Modal open={Boolean(candidate)} onClose={onClose} title={candidate.fullName} size="xl">
    <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><StageBadge stage={candidate.stage}/><Badge tone="neutral">{candidate.source === "careers" ? "Careers application" : "Staff sourced"}</Badge></div>
        <p className="mt-4 text-xl font-bold">{candidate.job?.title}</p><p className="mt-1 text-sm text-secondary">{candidate.job?.department} · {candidate.job?.location}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Email" value={candidate.email}/><Info label="Phone" value={candidate.phone || "Not provided"}/><Info label="City" value={candidate.city || "Not provided"}/><Info label="Current role" value={candidate.currentRole || "Not provided"}/><Info label="Notice period" value={candidate.noticePeriod || "Not provided"}/><Info label="Applied" value={dateLabel(candidate.createdAt)}/></div>
        {candidate.whySpotly && <Answer title="Why Spotly / this role" body={candidate.whySpotly}/>} {candidate.experience && <Answer title="Relevant experience" body={candidate.experience}/>} 
        <div className="mt-6 flex flex-wrap gap-2">{candidate.linkedIn && <Button asChild variant="outline" size="sm"><a href={candidate.linkedIn} target="_blank" rel="noreferrer">LinkedIn<ExternalLink className="h-4 w-4"/></a></Button>}{candidate.portfolio && <Button asChild variant="outline" size="sm"><a href={candidate.portfolio} target="_blank" rel="noreferrer">Work link<ExternalLink className="h-4 w-4"/></a></Button>}{candidate.cvAvailable && <Button variant="outline" size="sm" loading={busy === "cv"} onClick={openCv}><FileText className="h-4 w-4"/>{candidate.cvFileName || "Open CV"}</Button>}</div>

        <section className="mt-8 border-t pt-6">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Candidate communication</h3><p className="mt-1 text-xs text-secondary">Send from the hiring record so the contact remains auditable.</p></div><Mail className="h-5 w-5 text-[var(--accent)]"/></div>
          <div className="mt-4 space-y-3"><input value={message.subject} onChange={(event)=>setMessage((current)=>({...current,subject:event.target.value}))} placeholder={`Update about ${candidate.job?.title || "your Spotly application"}`} className={inputClass}/><textarea value={message.body} onChange={(event)=>setMessage((current)=>({...current,body:event.target.value}))} placeholder="Write the candidate-facing message. Do not put internal notes here." className={areaClass}/><div className="flex justify-end"><Button size="sm" onClick={sendMessage} loading={busy === "candidate_message"} disabled={!message.subject.trim() || message.body.trim().length < 10}><Mail className="h-4 w-4"/>Send email</Button></div></div>
          {candidate.communications?.length > 0 && <div className="mt-5 space-y-2">{candidate.communications.slice().reverse().slice(0, 5).map((item,index)=><div key={`${item.at}-${index}`} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{item.subject || "Candidate email"}</p><span className="text-xs text-tertiary">{dateLabel(item.at)}</span></div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-secondary">{item.message}</p></div>)}</div>}
        </section>

        <section className="mt-8 border-t pt-6"><h3 className="font-bold">Internal notes</h3><div className="mt-3 space-y-2">{candidate.notes?.length ? candidate.notes.slice().reverse().map((item,index)=><div key={`${item.at}-${index}`} className="rounded-xl bg-grouped p-3"><p className="text-sm leading-6">{item.note}</p><p className="mt-1 text-xs text-tertiary">{dateLabel(item.at)}</p></div>) : <p className="text-sm text-secondary">No internal notes yet.</p>}</div><div className="mt-4 flex gap-2"><input value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Add an internal hiring note" className={inputClass}/><Button size="sm" disabled={!note.trim()} loading={busy === "candidate_note"} onClick={()=>action({action:"candidate_note",applicationId:candidate.id,note:note.trim()})}><MessageSquareText className="h-4 w-4"/>Add</Button></div></section>

        {candidate.timeline?.length > 0 && <section className="mt-8 border-t pt-6"><h3 className="font-bold">Candidate timeline</h3><div className="mt-3 space-y-3">{candidate.timeline.slice().reverse().map((entry,index)=><div key={`${entry.at}-${index}`} className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]"/><div><p className="text-sm font-semibold">{entry.label || CAREER_STAGE_LABELS[entry.stage] || entry.stage}</p><p className="text-xs text-tertiary">{dateLabel(entry.at)}</p></div></div>)}</div></section>}
      </div>
      <aside className="border-t bg-[var(--surface-2)] p-5 lg:border-l lg:border-t-0">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-tertiary">Move candidate</p><div className="mt-3 grid gap-2">{ACTIVE_STAGES.filter((stage)=>stage!==candidate.stage).map((stage)=><Button key={stage} variant="outline" size="sm" loading={busy===stage} onClick={()=>action({action:"candidate_stage",applicationId:candidate.id,stage,note:note.trim()||undefined},stage)}>{CAREER_STAGE_LABELS[stage]}<ArrowRight className="h-4 w-4"/></Button>)}{candidate.stage !== "hired" && <Button size="sm" loading={busy === "hired"} onClick={async()=>{await action({action:"candidate_stage",applicationId:candidate.id,stage:"hired"},"hired");onStartOnboarding(candidate);}}><UserCheck className="h-4 w-4"/>Hire & onboard</Button>}{!["rejected","withdrawn"].includes(candidate.stage) && <Button variant="danger" size="sm" loading={busy === "rejected"} onClick={()=>action({action:"candidate_stage",applicationId:candidate.id,stage:"rejected",note:note.trim()||undefined},"rejected")}><XCircle className="h-4 w-4"/>Not moving forward</Button>}</div>
        <div className="mt-6 border-t pt-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-tertiary">Schedule interview</p><input type="datetime-local" value={interview.scheduledFor} onChange={(event)=>setInterview((v)=>({...v,scheduledFor:event.target.value}))} className={`${inputClass} mt-3`}/><div className="mt-2 grid grid-cols-3 gap-1">{["phone","video","in_person"].map((value)=><button key={value} type="button" onClick={()=>setInterview((v)=>({...v,format:value}))} className={`rounded-lg border px-2 py-2 text-[11px] font-semibold ${interview.format===value?"border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]":"bg-[var(--surface)]"}`}>{value.replaceAll("_"," ")}</button>)}</div><Button className="mt-3 w-full" size="sm" variant="outline" disabled={!interview.scheduledFor} loading={busy === "interview_schedule"} onClick={()=>action({action:"schedule_interview",applicationId:candidate.id,...interview},"interview_schedule")}><CalendarClock className="h-4 w-4"/>Schedule</Button></div>
        {candidate.interview && <div className="mt-5 rounded-xl bg-[var(--surface)] p-3 text-xs leading-5"><p className="font-bold">Interview booked</p><p className="mt-1 text-secondary">{dateLabel(candidate.interview.scheduledFor)} · {candidate.interview.format?.replaceAll("_"," ")}</p></div>}
      </aside>
    </div>
  </Modal>;
}
function SourcedCandidateModal({ open, onClose, jobs, onSaved }) {
  const { toast }=useToast(); const [busy,setBusy]=useState(false); const [form,setForm]=useState({jobId:"",fullName:"",email:"",phone:"",city:"",note:""});
  useEffect(()=>{if(open)setForm({jobId:jobs.find((job)=>job.status==="published")?.id||jobs[0]?.id||"",fullName:"",email:"",phone:"",city:"",note:""});},[open,jobs]);
  const jobOptions=jobs.filter((job)=>job.status!=="closed").map((job)=>({value:job.id,label:job.title,description:`${job.department} · ${job.location}`}));
  async function submit(event){event.preventDefault();setBusy(true);try{await authenticatedFetch("/api/staff/hiring",{method:"POST",body:JSON.stringify({action:"create_candidate",...form})});toast("Candidate added to screening.",{type:"success"});onClose();onSaved();}catch(error){toast(error.message,{type:"error",title:"Candidate could not be added"});}finally{setBusy(false);}}
  return <Modal open={open} onClose={onClose} title="Add sourced candidate" size="lg"><form onSubmit={submit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Field wide label="Role"><EntityPicker value={form.jobId} onChange={(value)=>setForm((v)=>({...v,jobId:value}))} options={jobOptions} title="Choose a role"/></Field><Field label="Full name"><input required value={form.fullName} onChange={(event)=>setForm((v)=>({...v,fullName:event.target.value}))} className={inputClass}/></Field><Field label="Email"><input required type="email" value={form.email} onChange={(event)=>setForm((v)=>({...v,email:event.target.value}))} className={inputClass}/></Field><Field label="Phone" optional><input value={form.phone} onChange={(event)=>setForm((v)=>({...v,phone:event.target.value}))} className={inputClass}/></Field><Field label="City" optional><input value={form.city} onChange={(event)=>setForm((v)=>({...v,city:event.target.value}))} className={inputClass}/></Field><Field wide label="Sourcing note" optional><textarea value={form.note} onChange={(event)=>setForm((v)=>({...v,note:event.target.value}))} className={areaClass}/></Field></div><div className="flex justify-end gap-2 border-t p-4"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Add to pipeline</Button></div></form></Modal>;
}

export function StaffHiring({ data, openModal }) {
  const { toast }=useToast(); const [state,setState]=useState({jobs:[],applications:[]}); const [loading,setLoading]=useState(true); const [tab,setTab]=useState("overview"); const [query,setQuery]=useState(""); const [stage,setStage]=useState("active"); const [roleEditor,setRoleEditor]=useState(null); const [candidate,setCandidate]=useState(null); const [sourcedOpen,setSourcedOpen]=useState(false); const [inviteCandidate,setInviteCandidate]=useState(null);
  const load=useCallback(async()=>{setLoading(true);try{const result=await authenticatedFetch("/api/staff/hiring",{cache:"no-store"});setState({jobs:result.jobs||[],applications:result.applications||[]});setCandidate((current)=>current?(result.applications||[]).find((item)=>item.id===current.id)||null:null);}catch(error){toast(error.message,{type:"error",title:"Hiring could not load"});}finally{setLoading(false);}},[toast]);
  useEffect(()=>{load();},[load]);
  const active=state.applications.filter((item)=>ACTIVE_STAGES.includes(item.stage)); const published=state.jobs.filter((item)=>item.status==="published"); const offers=state.applications.filter((item)=>item.stage==="offer"); const hired=state.applications.filter((item)=>item.stage==="hired");
  const filtered=state.applications.filter((item)=>{const text=[item.fullName,item.email,item.job?.title,item.job?.department,item.city].join(" ").toLowerCase();const stageOk=stage==="all"||(stage==="active"?ACTIVE_STAGES.includes(item.stage):item.stage===stage);return text.includes(query.toLowerCase())&&stageOk;});
  async function setJobStatus(job,status){try{await authenticatedFetch("/api/staff/hiring",{method:"POST",body:JSON.stringify({action:"job_status",jobId:job.id,status})});toast(`${job.title} is now ${status}.`,{type:"success"});load();}catch(error){toast(error.message,{type:"error",title:"Role status could not change"});}}
  function startOnboarding(item){const job=state.jobs.find((role)=>role.id===item.jobId);setInviteCandidate({...item,rolePackId:job?.rolePackId||"",department:job?.department||item.job?.department||""});setCandidate(null);setTab("onboarding");}
  return <div className="space-y-6"><div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--accent)]">People Operations</p><h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">Hiring</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">One pipeline from public careers to approved staff access. Publish roles, review applicants, interview, decide, then hand the same person into onboarding.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={spotlyPortalUrl("careers","/")} target="_blank" rel="noreferrer"><Globe2 className="h-4 w-4"/>View Careers<ExternalLink className="h-3.5 w-3.5"/></a></Button><Button variant="outline" onClick={()=>openModal("workforce")}><Plus className="h-4 w-4"/>Request headcount</Button><Button onClick={()=>setRoleEditor({})}><BriefcaseBusiness className="h-4 w-4"/>Open a role</Button></div></div>
    <Tabs value={tab} onChange={setTab} tabs={[{value:"overview",label:"Overview"},{value:"roles",label:`Open roles (${published.length})`},{value:"candidates",label:`Candidates (${active.length})`},{value:"onboarding",label:"Onboarding"}]} />
    {tab==="overview"&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Published roles" value={published.length} detail="Visible on careers.spotlyafrica.com" icon={BriefcaseBusiness}/><Metric label="Active candidates" value={active.length} detail="In screening through offer" icon={UsersRound}/><Metric label="At offer" value={offers.length} detail="Waiting for final hiring outcome" icon={Mail}/><Metric label="Hired" value={hired.length} detail="Ready for or already in onboarding" icon={UserCheck}/></div><div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><SectionCard title="Needs attention" description="Hiring work that can change what happens next."><div>{state.applications.filter((item)=>["new","offer"].includes(item.stage)).slice(0,8).map((item)=><button key={item.id} onClick={()=>setCandidate(item)} className="flex w-full items-start gap-4 border-b p-5 text-left last:border-b-0 hover:bg-grouped"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{item.stage==="offer"?<Mail className="h-5 w-5"/>:<UserPlus className="h-5 w-5"/>}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-bold">{item.fullName}</span><StageBadge stage={item.stage}/></span><span className="mt-1 block text-sm text-secondary">{item.job?.title} · {dateLabel(item.createdAt)}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary"/></button>)}{!state.applications.some((item)=>["new","offer"].includes(item.stage))&&<EmptyState icon={CheckCircle2} title="No urgent hiring actions" description="New applications and offer-stage candidates will appear here first."/>}</div></SectionCard><SectionCard title="Hiring system" description="Public recruiting and internal employment are connected."><div className="space-y-3 p-5">{[["1","Careers","Published roles and applications"],["2","Hiring","Screening, interviews, decisions"],["3","Onboarding","Secure invitation and People approval"],["4","Staff","Work, schedule, learning, pay and support"]].map(([n,title,desc])=><div key={n} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold">{n}</span><div><p className="text-sm font-bold">{title}</p><p className="text-xs text-secondary">{desc}</p></div></div>)}</div></SectionCard></div></>}
    {tab==="roles"&&<SectionCard><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Careers roles</h2><p className="mt-1 text-sm text-secondary">Published is public. Paused and closed roles stay available to the hiring team.</p></div><Button size="sm" onClick={()=>setRoleEditor({})}><Plus className="h-4 w-4"/>New role</Button></div><div>{state.jobs.map((job)=>{const count=state.applications.filter((item)=>item.jobId===job.id).length;return <div key={job.id} className="flex flex-col gap-4 border-b p-5 last:border-b-0 lg:flex-row lg:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><BriefcaseBusiness className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{job.title}</p><StatusBadge status={job.status}/>{job.featured&&<Badge tone="accent">Featured</Badge>}</div><p className="mt-1 text-sm text-secondary">{job.department} · {job.location} · {job.employmentType}</p><p className="mt-1 text-xs text-tertiary">{count} candidate{count===1?"":"s"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setRoleEditor(job)}>Edit</Button>{job.status==="published"?<Button size="sm" variant="outline" onClick={()=>setJobStatus(job,"paused")}><Pause className="h-4 w-4"/>Pause</Button>:<Button size="sm" variant="outline" onClick={()=>setJobStatus(job,"published")}><Play className="h-4 w-4"/>Publish</Button>}<Button asChild size="sm" variant="ghost"><a href={spotlyPortalUrl("careers",`/jobs/${job.id}`)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/>Preview</a></Button></div></div>})}{!state.jobs.length&&!loading&&<EmptyState icon={BriefcaseBusiness} title="No career roles yet" description="Create the first role and publish it to Spotly Careers."/>}</div></SectionCard>}
    {tab==="candidates"&&<><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex-1"><SearchField value={query} onChange={setQuery} placeholder="Search candidates, role, email, city"/></div><div className="flex flex-wrap gap-2">{["active","new","screening","interview","offer","hired","rejected","all"].map((value)=><button key={value} type="button" onClick={()=>setStage(value)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${stage===value?"border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]":"bg-[var(--surface)] hover:bg-grouped"}`}>{value==="active"?"Active":value==="all"?"All":CAREER_STAGE_LABELS[value]}</button>)}<Button size="sm" variant="outline" onClick={()=>setSourcedOpen(true)}><UserPlus className="h-4 w-4"/>Add sourced candidate</Button></div></div><SectionCard>{filtered.length?<div>{filtered.map((item)=><button key={item.id} onClick={()=>setCandidate(item)} className="flex w-full items-start gap-4 border-b p-5 text-left last:border-b-0 hover:bg-grouped"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-bold">{item.fullName}</span><StageBadge stage={item.stage}/>{item.source==="careers"&&<Badge tone="neutral">Careers</Badge>}</span><span className="mt-1 block text-sm text-secondary">{item.job?.title} · {item.email}</span><span className="mt-1 block text-xs text-tertiary">{item.city||"Location not provided"} · Applied {dateLabel(item.createdAt)}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary"/></button>)}</div>:<EmptyState icon={Search} title="No candidates in this view" description="Change the stage filter or search, or add a sourced candidate."/>}</SectionCard></>}
    {tab==="onboarding"&&<><div className="rounded-2xl border bg-[var(--surface)] p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><UserCheck className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h2 className="font-bold">Hiring ends where onboarding begins.</h2><p className="mt-1 text-sm leading-6 text-secondary">Send a secure onboarding invitation only after the hiring decision. People Operations still approves the submitted onboarding profile before Staff access activates.</p>{inviteCandidate&&<div className="mt-3 rounded-xl bg-grouped p-3 text-sm"><strong>{inviteCandidate.fullName}</strong> was marked hired. Use their details below to create the onboarding invitation.</div>}</div></div></div><StaffInvitations data={data} initialCandidate={inviteCandidate}/></>}
    <RoleEditor open={Boolean(roleEditor)} role={roleEditor?.id?roleEditor:null} onClose={()=>setRoleEditor(null)} onSaved={load}/><CandidateDetail candidate={candidate} onClose={()=>setCandidate(null)} onChanged={load} onStartOnboarding={startOnboarding}/><SourcedCandidateModal open={sourcedOpen} onClose={()=>setSourcedOpen(false)} jobs={state.jobs} onSaved={load}/>
  </div>;
}

function Field({label,children,wide=false,optional=false}){return <label className={`${wide?"sm:col-span-2":""} block`}><span className="mb-2 flex items-center gap-2 text-sm font-semibold">{label}{optional&&<span className="text-xs font-normal text-tertiary">Optional</span>}</span>{children}</label>}
function Info({label,value}){return <div className="rounded-xl bg-grouped p-3"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-tertiary">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>}
function Answer({title,body}){return <section className="mt-6"><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-secondary">{body}</p></section>}
