"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {CarFront,Package,RefreshCw,ShieldAlert,CheckCircle2} from "lucide-react";
import {authenticatedFetch} from "@/lib/api-client";
import {Badge,Button,Card,PageSkeleton} from "@/components/ui";

export function AdminMobilityLaunch({openRide,openSend}){
 const [data,setData]=useState(null),[error,setError]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[confirm,setConfirm]=useState({});
 const load=useCallback(async()=>{
  setLoading(true);
  try{setData(await authenticatedFetch("/api/admin/service-launch",{cache:"no-store"}));setError("");}
  catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 async function change(service,action){
  setBusy(service);setError("");
  try{
   await authenticatedFetch("/api/admin/service-launch",{method:"POST",body:JSON.stringify({
    service,action,confirmation:confirm[service]||""
   })});
   setConfirm(s=>({...s,[service]:""}));await load();
  }catch(e){setError(e.message);}
  finally{setBusy("");}
 }
 if(loading)return <PageSkeleton cards={2} rows={2}/>;
 return <div className="space-y-6">
  <Card className="v7-role-hero p-6">
   <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">Service Launch & Controls</p>
   <h2 className="mt-2 text-2xl font-semibold">Where and when SpotlyRide and SpotlySend operate</h2>
   <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">Configure cities, service zones, pricing and proof requirements in the service tabs. Activate only after all technical checks and real Driver/support field verification. Saving a draft never activates customer bookings.</p>
   <div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" onClick={openRide}><CarFront className="h-4 w-4"/>Configure Ride</Button><Button variant="outline" onClick={openSend}><Package className="h-4 w-4"/>Configure Send</Button><Button asChild variant="outline"><Link href="/admin/system?tab=launch"><ShieldAlert className="h-4 w-4"/>Full launch readiness</Link></Button></div>
  </Card>
  {error&&<div role="alert" className="rounded-xl border border-danger bg-[var(--danger-soft)] p-4 text-sm text-danger">{error}</div>}
  <div className="grid gap-5 lg:grid-cols-2">
   {(data?.services||[]).map(item=>{
    const name=item.service==="ride"?"SpotlyRide":"SpotlySend";
    const action=item.enabled?"disable":"enable";
    const phrase=(action==="enable"?"ENABLE":"DISABLE")+" SPOTLY "+item.service.toUpperCase();
    return <Card className="p-5 sm:p-6" key={item.service}>
     <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">{name}</p><h3 className="mt-2 text-xl font-semibold">{item.enabled?"Accepting requests":"Customer booking disabled"}</h3></div>
      <Badge tone={item.enabled?"success":item.ready?"warning":"danger"}>{item.enabled?"Live switch ON":item.ready?"Ready to review":"Blocked"}</Badge>
     </div>
     <p className="mt-3 text-sm text-secondary">{item.cityCount} approved pickup cities · {item.geoFenceCount} geofences · scheduler {item.scheduler?.ready?"recurring calls verified":item.schedulerVerified?"flag set, calls not verified":"not verified"}</p>
     <p className="mt-2 text-xs text-secondary">Paynow credentials: {item.paynowCredentialsConfigured?
       "present for the configured fare currency · transaction validation still required":
       "not configured for this service currency (cash may still be available)"}</p>
     <p className="mt-2 text-xs text-secondary">{item.scheduler?.lastTickAt?
       `Last authenticated dispatcher: ${item.scheduler.ageSeconds}s ago · ${item.scheduler.consecutive} consecutive successful intervals`:
       "No recent authenticated dispatch heartbeat recorded"}</p>
     {item.missing?.length?<div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4">
      <p className="text-sm font-semibold">Before enabling</p>
      <ul className="mt-2 space-y-1.5 pl-5 text-xs leading-5 text-secondary">{item.missing.map(m=><li key={m} className="list-disc">{m}</li>)}</ul>
     </div>:<p className="mt-5 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4"/>Technical launch prerequisites are recorded. Field approval is still required.</p>}
     <div className="mt-5 grid gap-3">
      <label className="text-xs font-semibold">Type <span className="font-mono">{phrase}</span> to {action==="enable"?"activate":"pause"} this service
       <input className="field-control mt-2 w-full" autoComplete="off" value={confirm[item.service]||""} onChange={e=>setConfirm(s=>({...s,[item.service]:e.target.value}))} placeholder={phrase}/>
      </label>
      <Button color={action==="enable"?"primary":undefined} variant={action==="disable"?"outline":"primary"} loading={busy===item.service}
       disabled={confirm[item.service]!==phrase||(action==="enable"&&!item.ready)} onClick={()=>change(item.service,action)}>
       {action==="enable"?"Activate customer requests":"Pause customer requests"}
      </Button>
      <Button variant="ghost" onClick={item.service==="ride"?openRide:openSend}>Edit {name} pricing, cities, zones and dispatch</Button>
     </div>
    </Card>;
   })}
  </div>
  <Button variant="ghost" onClick={load}><RefreshCw className="h-4 w-4"/>Refresh launch status</Button>
 </div>;
}
