"use client";
import {MapPin, Navigation} from "lucide-react";
/** Geospatial overview from the configured road router; intentionally not a street-tile map. */
export function RideRouteOverview({pickup,dropoff,path=[],driverLocation=null}){
 const raw=path.length>=2?path:[pickup,dropoff];
 const coords=[...raw,pickup,dropoff,...(driverLocation?[driverLocation]:[])].filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)));
 if(coords.length<2)return null;
 const minX=Math.min(...coords.map(p=>p.lng)),maxX=Math.max(...coords.map(p=>p.lng));
 const minY=Math.min(...coords.map(p=>p.lat)),maxY=Math.max(...coords.map(p=>p.lat));
 const spanX=Math.max(.001,maxX-minX),spanY=Math.max(.001,maxY-minY);
 const px=p=>({x:24+272*(Number(p.lng)-minX)/spanX,y:164-136*(Number(p.lat)-minY)/spanY});
 const line=raw.filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)))
  .map((p,i)=>{const s=px(p);return (i?"L":"M")+s.x.toFixed(1)+" "+s.y.toFixed(1);}).join(" ");
 const pickupPt=px(pickup),dropoffPt=px(dropoff),driver=driverLocation?px(driverLocation):null;
 return <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
  <div className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold">Verified route overview</p><p className="mt-1 text-xs text-[var(--text-2)]">Geographic route preview · not turn-by-turn street navigation</p></div><Navigation className="h-5 w-5 text-[var(--accent)]"/></div>
  <svg viewBox="0 0 320 190" role="img" aria-label="Road route from pickup to destination with latest available Driver position" className="block w-full bg-[var(--surface)]">
   <defs><pattern id="spotly-ride-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".06"/></pattern></defs>
   <rect width="320" height="190" fill="url(#spotly-ride-grid)"/>
   <path d={line} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
   {[{...pickupPt,label:"P"},{...dropoffPt,label:"D"}].map(p=><g key={p.label}><circle cx={p.x} cy={p.y} r="10" fill="var(--accent)"/><text x={p.x} y={p.y+4} fill="white" textAnchor="middle" fontSize="10" fontWeight="bold">{p.label}</text></g>)}
   {driver&&<g><circle cx={driver.x} cy={driver.y} r="15" fill="var(--accent)" fillOpacity=".16"/><circle cx={driver.x} cy={driver.y} r="6" fill="var(--accent)" stroke="white" strokeWidth="2"/></g>}
  </svg>
  <div className="flex items-center justify-between gap-3 p-4 text-xs text-[var(--text-2)]"><span><MapPin className="mr-1 inline h-3.5 w-3.5"/>P Pickup · D Destination</span><span>{driver?"Driver GPS received":"Awaiting Driver GPS"}</span></div>
 </div>;
}
