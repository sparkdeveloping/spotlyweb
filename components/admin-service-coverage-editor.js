"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {CheckCircle2,MapPin,Search,Trash2,AlertTriangle,Navigation} from "lucide-react";
import {Button} from "@/components/ui";
import {loadMapLibrary,loadStyle} from "@/components/mobility-map";
import {publicApiFetch} from "@/lib/api-client";
import {normalizedCoverageKey,verifyCoverageZone,MOBILITY_COUNTRIES} from "@/lib/mobility-coverage";

const fallback={ZW:[31.05,-17.83],MW:[33.78,-13.96]};
const coords=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))?
 [Number(p.lng),Number(p.lat)]:null;

function circleGeometry(zone){
 if(!zone||!coords(zone))return {type:"FeatureCollection",features:[]};
 const lat=Number(zone.lat),lng=Number(zone.lng),radiusKm=Number(zone.radiusKm)||15;
 const latRad=lat*Math.PI/180;
 const line=[];
 for(let i=0;i<=96;i++){
  const angle=2*Math.PI*i/96;
  const dx=radiusKm*Math.sin(angle),dy=radiusKm*Math.cos(angle);
  line.push([lng+dx/(111.32*Math.max(.1,Math.cos(latRad))),lat+dy/110.574]);
 }
 return {type:"FeatureCollection",features:[{
  type:"Feature",properties:{},
  geometry:{type:"Polygon",coordinates:[line]}
 }]};
}

export function ServiceCoverageEditor({service="ride",cities=[],allowedCountries=["ZW"],fences={},onChange}){
 const isSend=service==="send",supported=isSend?["ZW"]:["ZW","MW"];
 const [country,setCountry]=useState(supported[0]);
 const [city,setCity]=useState("");
 const [draft,setDraft]=useState(null);
 const [error,setError]=useState("");
 const [mapError,setMapError]=useState("");
 const [searching,setSearching]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const [dirty,setDirty]=useState(false);
 const mapRef=useRef(null),nodeRef=useRef(null),pinRef=useRef(null);
 const cityOptions=useMemo(()=>[...new Set(cities.map(x=>String(x).trim()).filter(Boolean))], [cities.join("\u001f")]);
 const zoneKey=normalizedCoverageKey(country,city);
 const saved=fences[zoneKey];
 useEffect(()=>{
  if(!cityOptions.includes(city))setCity(cityOptions[0]||"");
 },[cityOptions.join("\u001f"),city]);
 useEffect(()=>{
  setDraft(saved?{lat:Number(saved.lat),lng:Number(saved.lng),radiusKm:Number(saved.radiusKm)}:null);
  setDirty(false);setError("");
 },[zoneKey,saved?.lat,saved?.lng,saved?.radiusKm]);

 useEffect(()=>{
  let cancelled=false,instance;
  setMapError("");setMapReady(false);
  if(!nodeRef.current)return undefined;
  Promise.all([loadMapLibrary(),loadStyle()]).then(([gl,style])=>{
   if(cancelled||!nodeRef.current)return;
   const existing=fences[normalizedCoverageKey(country,city)];
   const center=coords(existing)||fallback[country];
   instance=new gl.Map({container:nodeRef.current,style,center,zoom:existing?10:9,
     maxZoom:18,attributionControl:true});
   mapRef.current=instance;
   instance.addControl(new gl.NavigationControl({showCompass:false}),"top-right");
   instance.on("load",()=>{
    if(cancelled)return;
    instance.addSource("admin-service-zone",{type:"geojson",data:circleGeometry(existing)});
    instance.addLayer({id:"admin-zone-fill",type:"fill",source:"admin-service-zone",
      paint:{"fill-color":"#775ce7","fill-opacity":.18}});
    instance.addLayer({id:"admin-zone-boundary",type:"line",source:"admin-service-zone",
      paint:{"line-color":"#775ce7","line-width":3}});
    if(existing){
      pinRef.current=new gl.Marker({color:"#6d57dc",draggable:true})
       .setLngLat(coords(existing)).addTo(instance);
      pinRef.current.on("dragend",()=>{
       const point=pinRef.current.getLngLat();
       setDraft(prev=>({lat:Number(point.lat.toFixed(6)),lng:Number(point.lng.toFixed(6)),radiusKm:prev?.radiusKm||15}));
       setDirty(true);setError("");
      });
    }
    setMapReady(true);instance.resize();
   });
   instance.on("click",e=>{
    if(cancelled)return;
    setDraft(prev=>({lat:Number(e.lngLat.lat.toFixed(6)),lng:Number(e.lngLat.lng.toFixed(6)),radiusKm:prev?.radiusKm||15}));
    setDirty(true);setError("");
   });
   instance.on("error",()=>{if(!cancelled)setMapError("Map tiles could not load. Add your Admin domain to the MapTiler key's allowed origins.")});
  }).catch(e=>{if(!cancelled)setMapError(e.message||"Unable to load service-area map.")});
  return()=>{cancelled=true;mapRef.current=null;pinRef.current=null;instance?.remove()};
  // Recreate only when choosing another city or country. Changing coverage uses setData.
 },[country,city]);

 useEffect(()=>{
  const instance=mapRef.current;
  if(!mapReady||!instance?.isStyleLoaded?.())return;
  instance.getSource("admin-service-zone")?.setData(circleGeometry(draft));
  if(draft){
   if(pinRef.current)pinRef.current.setLngLat(coords(draft));
   else if(window.maplibregl){
    const marker=new window.maplibregl.Marker({color:"#6d57dc",draggable:true})
      .setLngLat(coords(draft)).addTo(instance);
    marker.on("dragend",()=>{
     const ll=marker.getLngLat();
     setDraft(prev=>({lat:Number(ll.lat.toFixed(6)),lng:Number(ll.lng.toFixed(6)),radiusKm:prev?.radiusKm||15}));
     setDirty(true);setError("");
    });
    pinRef.current=marker;
   }
  }else{pinRef.current?.remove();pinRef.current=null}
 },[draft?.lat,draft?.lng,draft?.radiusKm,mapReady]);

 async function locateCity(){
  if(!city)return setError("First add a city in the Enabled cities field.");
  setSearching(true);setError("");
  try{
   const data=await publicApiFetch(`/api/public/geocode?q=${encodeURIComponent(city)}&country=${country}&city=${encodeURIComponent(city)}`);
   const results=(data.results||[]).filter(x=>x.country===country&&coords(x));
   const result=results.find(x=>x.city?.toLowerCase()===city.toLowerCase())||results[0];
   if(!result)throw new Error("No matching city found. Pan the map and select your service center manually.");
   mapRef.current?.flyTo({center:coords(result),zoom:11,essential:true});
  }catch(e){setError(e.message||"City lookup failed. You can still select the center on the map.");}
  finally{setSearching(false);}
 }
 function stageZone(){
  try{
   if(!draft)throw Error("Tap the map or drag the marker to place your service area's center.");
   const {key,value}=verifyCoverageZone({country,city,...draft},
     {enabledCountries:allowedCountries,enabledCities:cityOptions,send:isSend});
   onChange({...fences,[key]:value});
   setDirty(false);setError("");
  }catch(e){setError(e.message)}
 }
 function deleteZone(key){
  const clone={...fences};delete clone[key];onChange(clone);
  if(zoneKey===key){setDraft(null);setDirty(false);}
 }
 const rows=Object.entries(fences||{}).filter(([_,x])=>x&&typeof x==="object");
 return <section className="mt-5 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5" aria-label="Service coverage editor">
  <div>
   <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">Service area management</p>
   <h3 className="mt-1 text-lg font-semibold">Choose your pickup coverage on a map</h3>
   <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Choose an enabled city, find it on the map, then tap or drag the marker to define where Driver pickups are permitted. Adjust the radius to cover the neighborhoods you can actually support. No coordinates or geofence codes to type.</p>
  </div>
  <div className="grid gap-3 sm:grid-cols-3">
   <label className="text-xs font-semibold">Country
    <select className="field-control mt-2 h-11 w-full" value={country} onChange={e=>setCountry(e.target.value)}>
     {supported.map(code=><option value={code} key={code}>{MOBILITY_COUNTRIES[code]}{!allowedCountries.includes(code)?" (not enabled)":""}</option>)}
    </select>
   </label>
   <label className="text-xs font-semibold">Enabled city
    <select className="field-control mt-2 h-11 w-full" value={city} onChange={e=>setCity(e.target.value)}>
     {!cityOptions.length?<option value="">Add a city above first</option>:null}
     {cityOptions.map(x=><option value={x} key={x}>{x}</option>)}
    </select>
   </label>
   <div className="flex items-end"><Button variant="outline" className="w-full" onClick={locateCity} loading={searching} disabled={!city||!mapReady}>
     <Search className="h-4 w-4"/>Find city on map
   </Button></div>
  </div>
  {!allowedCountries.includes(country)?
    <p role="alert" className="text-xs text-danger">Enable {MOBILITY_COUNTRIES[country]} in Approved countries before saving coverage.</p>:null}
  <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
   <div ref={nodeRef} className="h-[350px] w-full sm:h-[430px]" aria-label="Interactive map for choosing a service area center"/>
   {mapError?<p role="alert" className="p-3 text-xs text-danger">{mapError}</p>:null}
   <p className="px-3 py-2 text-xs text-secondary">Map data © OpenStreetMap contributors. Purple circle shows the editable coverage radius. Click or drag to reposition.</p>
  </div>
  <div className="grid items-center gap-4 md:grid-cols-[1fr_auto]">
   <div>
    <div className="flex flex-wrap items-center justify-between gap-2">
     <label htmlFor={`coverage-radius-${service}`} className="text-sm font-semibold">Pickup coverage radius</label>
     <span className="font-semibold tabular-nums">{draft?.radiusKm||15} km</span>
    </div>
    <input id={`coverage-radius-${service}`} className="mt-3 w-full accent-[var(--accent)]" type="range" min="3" max="100" step="1"
     disabled={!draft} value={draft?.radiusKm||15} onChange={e=>{setDraft(x=>x?{...x,radiusKm:Number(e.target.value)}:x);setDirty(true);}}/>
    <p className="mt-1 text-xs text-secondary">{draft?`Selected map center: ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`:"Tap the map to place a center. No coverage zone has been drafted."}</p>
   </div>
   <Button onClick={stageZone} disabled={!city||!draft||!mapReady}>
    <MapPin className="h-4 w-4"/>{saved?"Update city coverage":"Add city coverage"}
   </Button>
  </div>
  {error?<p role="alert" className="flex gap-2 text-xs text-danger"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</p>:null}
  {dirty?<p className="text-xs font-medium text-secondary">Map edits are not yet added. Click Update/Add city coverage, then Save {isSend?"Send":"Ride"} network above.</p>:null}
  <div className="border-t border-[var(--border)] pt-4">
   <p className="text-sm font-semibold">Configured pickup zones ({rows.length})</p>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {rows.map(([key,zone])=><div key={key} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
     <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]"/>
     <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{key.split(":").slice(1).join(":")} · {MOBILITY_COUNTRIES[zone.country]||zone.country}</p>
      <p className="mt-1 text-xs text-secondary">{zone.radiusKm} km pickup radius · saved in current draft</p></div>
     <button type="button" aria-label={`Remove coverage for ${key}`} className="rounded-lg p-2 text-secondary hover:bg-[var(--surface-2)] hover:text-danger" onClick={()=>deleteZone(key)}>
       <Trash2 className="h-4 w-4"/></button>
    </div>)}
    {!rows.length?<p className="text-xs text-secondary">No pickup zones configured. Add your first area above, then save the network.</p>:null}
   </div>
   <p className="mt-3 text-xs text-secondary">Coverage is a controlled circular service zone, not an automatically approved entire city. Changes take effect only after saving the network. This never activates bookings.</p>
  </div>
 </section>;
}
