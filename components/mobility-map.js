"use client";

import {useEffect,useRef,useState} from "react";
import {MapPin,LocateFixed,Navigation,X,AlertTriangle} from "lucide-react";
import {Button} from "@/components/ui";
import {publicApiFetch} from "@/lib/api-client";

// Client-side SDK only; production map tiles/style are provided by a separately
// licensed provider, never by OSMF's shared tile infrastructure.
let mapLibraryPromise;
function loadMapLibrary(){
 if(typeof window==="undefined")return Promise.reject(new Error("Interactive map requires a browser."));
 if(window.maplibregl)return Promise.resolve(window.maplibregl);
 if(!mapLibraryPromise)mapLibraryPromise=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-spotly-maps]')){
   const stylesheet=document.createElement("link");
   stylesheet.rel="stylesheet";
   stylesheet.href="https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.css";
   stylesheet.dataset.spotlyMaps="true";
   document.head.appendChild(stylesheet);
  }
  const script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.js";
  script.async=true;script.crossOrigin="anonymous";
  script.onload=()=>window.maplibregl?resolve(window.maplibregl):reject(new Error("Map library did not initialize."));
  script.onerror=()=>reject(new Error("Could not load the map library. Check your connection."));
  document.head.appendChild(script);
 }).catch(err=>{mapLibraryPromise=null;throw err});
 return mapLibraryPromise;
}
async function loadStyle(){
 const response=await fetch("/api/public/map-config",{cache:"no-store"});
 if(!response.ok)throw new Error("Map configuration could not be loaded.");
 const result=await response.json();
 if(!result.ready||!result.styleUrl)throw new Error(result.message||"Map tiles are not configured.");
 return result.styleUrl;
}
function coordinates(p){const lat=Number(p?.lat),lng=Number(p?.lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lng,lat]:null}
const defaultCenter=country=>country==="MW"?[33.78,-13.96]:[31.05,-17.83];

export function PinDropMap({open,onClose,onSelect,initialPoint,country="ZW",label="Choose location"}){
 const container=useRef(null),mapInstance=useRef(null),marker=useRef(null);
 const [selected,setSelected]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{
  if(!open)return;
  let cancelled=false;
  let map;
  setSelected(null);setError("");setReady(false);
  Promise.all([loadMapLibrary(),loadStyle()]).then(([lib,style])=>{
   if(cancelled||!container.current)return;
   const start=coordinates(initialPoint)||defaultCenter(country);
   map=new lib.Map({container:container.current,style,center:start,zoom:coordinates(initialPoint)?14:11,
     attributionControl:true,maxZoom:19});
   map.addControl(new lib.NavigationControl({showCompass:false}),"top-right");
   const pin=new lib.Marker({color:"#e36544",draggable:true}).setLngLat(start).addTo(map);
   marker.current=pin;mapInstance.current=map;
   const update=(pos)=>{setSelected({lat:Number(pos.lat.toFixed(6)),lng:Number(pos.lng.toFixed(6))});setError("");};
   map.on("click",event=>{pin.setLngLat(event.lngLat);update(event.lngLat)});
   pin.on("dragend",()=>update(pin.getLngLat()));
   map.on("load",()=>{if(!cancelled){setReady(true);map.resize();}});
   map.on("error",()=>{if(!cancelled)setError("The map provider could not display this area.")});
  }).catch(err=>{if(!cancelled)setError(err.message)});
  return()=>{cancelled=true;marker.current=null;mapInstance.current=null;map?.remove()};
 },[open,country,initialPoint?.lat,initialPoint?.lng]);
 async function confirm(){
  if(!selected)return setError("Tap the map or drag the marker to choose the exact location.");
  setBusy(true);setError("");
  try{
   const data=await publicApiFetch(`/api/public/reverse-geocode?lat=${encodeURIComponent(selected.lat)}&lng=${encodeURIComponent(selected.lng)}`);
   const location=data.location;
   if(!location||location.country!==country)throw new Error("Choose a location in the selected country.");
   onSelect(location);onClose();
  }catch(err){setError(err.message||"Could not verify this location. Try another pin position.");}
  finally{setBusy(false)}
 }
 if(!open)return null;
 return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={label} onKeyDown={e=>{if(e.key==="Escape")onClose()}}>
  <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl">
   <div className="flex items-center justify-between gap-3 p-4"><div><p className="text-lg font-semibold">{label}</p>
    <p className="mt-1 text-xs text-secondary">Tap the street map or drag the orange pin. We verify the address before using it in pricing.</p></div>
    <button aria-label="Close location map" className="rounded-xl p-2 hover:bg-[var(--surface-2)]" onClick={onClose}><X className="h-5 w-5"/></button>
   </div>
   <div ref={container} className="h-[min(56vh,490px)] w-full bg-[var(--surface-2)]" role="application" aria-label="Interactive street map. Tap or drag pin to choose address"/>
   {error&&<p role="alert" className="flex items-start gap-2 px-4 pt-3 text-sm text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3 p-4">
    <span className="text-xs text-secondary">{selected?`${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`:"No pin selected yet"}
      <span className="ml-2">Map data © OpenStreetMap contributors</span></span>
    <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={confirm} loading={busy} disabled={!selected||!ready}>
     <MapPin className="h-4 w-4"/>Use this pin</Button></div>
   </div>
  </div>
 </div>;
}

export function RoadRouteMap({pickup,dropoff,path=[],driverLocation=null,driverUpdatedAt=null,compact=false}){
 const container=useRef(null),map=useRef(null),pinMarkers=useRef([]),driverMarker=useRef(null);
 const [error,setError]=useState("");
 const coords=[pickup,...path,dropoff].map(coordinates).filter(Boolean);
 const hasRoute=Array.isArray(path)&&path.length>=2;
 const routeRef=useRef({path,pickup,dropoff,driverLocation,driverUpdatedAt});
 routeRef.current={path,pickup,dropoff,driverLocation,driverUpdatedAt};
 useEffect(()=>{
  if(!container.current||!coordinates(pickup)||!coordinates(dropoff))return;
  let cancelled=false;let instance;
  Promise.all([loadMapLibrary(),loadStyle()]).then(([lib,style])=>{
   if(cancelled||!container.current)return;
   instance=new lib.Map({container:container.current,style,center:coordinates(pickup),zoom:11,
     attributionControl:true,interactive:!compact});
   map.current=instance;
   instance.addControl(new lib.NavigationControl({showCompass:false}),"top-right");
   instance.on("load",()=>{
    if(cancelled)return;
    const data=routeRef.current;
    const line=(data.path?.length>=2?data.path:[data.pickup,data.dropoff]).map(coordinates).filter(Boolean);
    instance.addSource("road-route",{type:"geojson",data:{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:line}}});
    instance.addLayer({id:"road-route-underlay",type:"line",source:"road-route",paint:{"line-color":"#ffffff","line-width":8,"line-opacity":.85}});
    instance.addLayer({id:"road-route-line",type:"line",source:"road-route",paint:{"line-color":"#db623b","line-width":5,"line-opacity":.95}});
    const pins=[
      {value:data.pickup,text:"P",color:"#177a55"},
      {value:data.dropoff,text:"D",color:"#d05243"}
    ];
    // Driver position gets its own marker so subsequent GPS updates can move it independently.
    for(const pin of pins){
     const el=document.createElement("div");el.textContent=pin.text;el.style.cssText=`width:30px;height:30px;border:3px solid white;border-radius:50%;background:${pin.color};color:white;display:grid;place-items:center;font-weight:700;box-shadow:0 2px 8px #0005;`;
     const m=new lib.Marker({element:el}).setLngLat(coordinates(pin.value)).addTo(instance);pinMarkers.current.push(m);
    }
    const initialFix=new Date(data.driverUpdatedAt||data.driverLocation?.updatedAt||0).getTime();
    if(initialFix&&Date.now()-initialFix<=120000&&coordinates(data.driverLocation)){
      const car=document.createElement("div");car.textContent="Dvr";
      car.style.cssText="width:36px;height:28px;border:2px solid white;border-radius:12px;background:#1e65a7;color:white;font-size:11px;display:grid;place-items:center;font-weight:700;box-shadow:0 2px 8px #0005;";
      driverMarker.current=new lib.Marker({element:car}).setLngLat(coordinates(data.driverLocation)).addTo(instance);
    }
    const all=line.concat([coordinates(data.pickup),coordinates(data.dropoff)]).filter(Boolean);
    if(all.length>=2){
     const bounds=all.reduce((b,c)=>b.extend(c),new lib.LngLatBounds(all[0],all[0]));
     instance.fitBounds(bounds,{padding:compact?25:45,maxZoom:15,duration:0});
    }
   });
  }).catch(e=>{if(!cancelled)setError(e.message)});
  return()=>{cancelled=true;pinMarkers.current.forEach(m=>m.remove());pinMarkers.current=[];driverMarker.current?.remove();driverMarker.current=null;instance?.remove();map.current=null};
 },[pickup?.lat,pickup?.lng,dropoff?.lat,dropoff?.lng,compact]);
 useEffect(()=>{
  const instance=map.current;if(!instance?.isStyleLoaded?.())return;
  const line=(hasRoute?path:[pickup,dropoff]).map(coordinates).filter(Boolean);
  if(line.length>=2)instance.getSource("road-route")?.setData({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:line}});
 },[path,hasRoute,pickup,dropoff]);
 useEffect(()=>{
  const instance=map.current,fixTime=new Date(driverUpdatedAt||driverLocation?.updatedAt||0).getTime(),
    pos=coordinates(driverLocation);
  if(!instance?.isStyleLoaded?.())return;
  if(!pos||!fixTime||Date.now()-fixTime>120000){
    driverMarker.current?.remove();driverMarker.current=null;return;
  }
  if(driverMarker.current)driverMarker.current.setLngLat(pos);
  else if(window.maplibregl){
    const car=document.createElement("div");car.textContent="Dvr";
    car.style.cssText="width:36px;height:28px;border:2px solid white;border-radius:12px;background:#1e65a7;color:white;font-size:11px;display:grid;place-items:center;font-weight:700;box-shadow:0 2px 8px #0005;";
    driverMarker.current=new window.maplibregl.Marker({element:car}).setLngLat(pos).addTo(instance);
  }
 },[driverLocation?.lat,driverLocation?.lng,driverLocation?.updatedAt,driverUpdatedAt]);
 const lastFix=new Date(driverUpdatedAt||driverLocation?.updatedAt||0).getTime();
 const recentDriver=lastFix&&Date.now()-lastFix<=120000&&coordinates(driverLocation);
 return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
   <div className="flex items-center justify-between gap-2 p-3"><div><p className="text-sm font-semibold">Road route</p>
     <p className="mt-1 text-xs text-secondary">Verified driving route · {recentDriver?"Driver GPS recent":"Driver position may be unavailable or stale"}</p></div><Navigation className="h-4 w-4 text-[var(--accent)]"/></div>
   <div ref={container} className={compact?"h-48 w-full":"h-[290px] w-full"} aria-label="Route street map"/>
   {error&&<p className="px-3 py-2 text-xs text-secondary">{error}</p>}
   <p className="p-3 text-xs text-secondary">Map data © OpenStreetMap contributors. Traffic-aware arrival times are not guaranteed.</p>
  </div>;
}
