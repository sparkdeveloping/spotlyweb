import { partnerGroups } from "@/data/site";
import { AnimatedSection } from "./AnimatedSection";
import { Building2, CheckCircle2 } from "lucide-react";

export function PartnerPipeline() {
  return (
    <AnimatedSection id="partners" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-spotly-700">Partner pipeline</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">Launch partner categories are already reflected in the product.</h2>
        </div>
        <p className="max-w-md text-base font-semibold leading-7 text-slateSoft">Dummy data supports demos today; business self-onboarding can follow after the customer app feels complete.</p>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-5">
        {partnerGroups.map((group) => (
          <div key={group.name} className="rounded-panel border border-line bg-white p-5 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-spotly-50 text-spotly-700">
                <Building2 className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-paper px-3 py-1 text-xs font-black text-slateSoft">{group.status}</span>
            </div>
            <h3 className="text-lg font-black text-ink">{group.name}</h3>
            <div className="mt-5 space-y-3">
              {group.brands.map((brand) => (
                <div key={brand} className="flex items-center gap-2 text-sm font-bold text-slateSoft">
                  <CheckCircle2 className="h-4 w-4 text-spotly-700" /> {brand}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AnimatedSection>
  );
}
