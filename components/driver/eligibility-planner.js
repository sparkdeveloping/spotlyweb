"use client";

import { useMemo, useState } from "react";
import { Bike, CarFront, CheckCircle2, Gauge, Truck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { zimbabweCities } from "@/data/business-config";
import { DRIVER_CAPABILITIES, capabilitySupportsVehicle, documentRequirementsFor, trainingRequirementsFor } from "@/lib/driver-capabilities";
import { cn } from "@/lib/cn";
import { spotlyPortalUrl } from "@/lib/spotly-domains";
import Link from "next/link";

const vehicles = [
  ["bicycle", "Bicycle", Bike],
  ["motorcycle", "Motorcycle", Gauge],
  ["car", "Car", CarFront],
  ["van", "Van", Truck]
];
const documentLabels = { identity: "Identification", licence: "Driver licence", registration: "Vehicle registration", insurance: "Vehicle insurance", vehicle_fitness: "Vehicle fitness / inspection" };

export function DriverEligibilityPlanner() {
  const [city, setCity] = useState("Harare");
  const [vehicleType, setVehicleType] = useState("motorcycle");
  const [selected, setSelected] = useState(["prepared_delivery", "send"]);
  const available = useMemo(() => Object.values(DRIVER_CAPABILITIES).filter((item) => capabilitySupportsVehicle(item.id, vehicleType)), [vehicleType]);
  const capabilities = selected.filter((id) => capabilitySupportsVehicle(id, vehicleType));
  const documents = documentRequirementsFor({ vehicleType, capabilities });
  const training = trainingRequirementsFor(capabilities);
  function chooseVehicle(next) {
    setVehicleType(next);
    setSelected((current) => {
      const supported = current.filter((id) => capabilitySupportsVehicle(id, next));
      return supported.length ? supported : ["prepared_delivery"].filter((id) => capabilitySupportsVehicle(id, next));
    });
  }
  function toggle(id) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  return <Card className="overflow-hidden border-[color-mix(in_srgb,var(--driver)_24%,var(--border))]">
    <div className="grid gap-0 lg:grid-cols-[.9fr_1.1fr]">
      <div className="p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.12em] text-driver">Check before you apply</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.035em]">What could you qualify to do?</h3><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">This planner explains the likely requirements. It does not promise approval or service availability.</p>
        <label className="mt-6 block text-sm font-medium">City<select className="field-control mt-2 w-full" value={city} onChange={(e) => setCity(e.target.value)}>{zimbabweCities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <p className="mt-5 text-sm font-medium">Vehicle</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">{vehicles.map(([id,label,Icon]) => <button key={id} type="button" onClick={() => chooseVehicle(id)} className={cn("rounded-xl border p-3 text-left", vehicleType === id && "border-driver bg-[var(--driver-soft)]")}><Icon className="h-5 w-5 text-driver"/><span className="mt-3 block text-sm font-semibold">{label}</span></button>)}</div>
        <p className="mt-5 text-sm font-medium">Work you want</p><div className="mt-2 space-y-2">{available.map((item) => <button type="button" key={item.id} onClick={() => toggle(item.id)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left", capabilities.includes(item.id) && "border-driver bg-[var(--driver-soft)]")}><span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", capabilities.includes(item.id) && "border-driver bg-driver text-[var(--on-driver)]")}>{capabilities.includes(item.id) ? <CheckCircle2 className="h-3.5 w-3.5"/> : null}</span><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--text-2)]">{item.description}</span></span></button>)}</div>
      </div>
      <div className="bg-[var(--surface-2)] p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-3)]">Your likely path in {city}</p><h3 className="mt-2 text-xl font-semibold">{capabilities.length ? `${capabilities.length} work type${capabilities.length === 1 ? "" : "s"} selected` : "Choose at least one work type"}</h3>
        <div className="mt-5 space-y-3">{capabilities.map((id) => <div key={id} className="rounded-xl bg-[var(--surface)] p-4"><p className="font-semibold">{DRIVER_CAPABILITIES[id].label}</p><p className="mt-1 text-xs text-[var(--text-2)]">Can use: {DRIVER_CAPABILITIES[id].vehicleTypes.join(", ")}</p></div>)}</div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Prepare these documents</p><ul className="mt-3 space-y-2 text-sm">{documents.map((type) => <li key={type} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-driver"/>{documentLabels[type] || type}</li>)}</ul></div><div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Short training</p><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{training.length} operating module{training.length === 1 ? "" : "s"}, based on the work you selected.</p>{vehicleType === "bicycle" ? <p className="mt-3 rounded-lg bg-[var(--success-soft)] p-3 text-xs font-medium text-success">Bicycle applications do not inherit motor-vehicle registration or Driver-licence requirements.</p> : null}</div></div>
        <Button asChild className="mt-7 w-full"><Link href={spotlyPortalUrl("driver")}>Start with this plan</Link></Button>
      </div>
    </div>
  </Card>;
}
