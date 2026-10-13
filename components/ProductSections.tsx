import { appFeatures, screenCards } from "@/data/site";
import { AnimatedSection } from "./AnimatedSection";
import { ArrowUpRight, CheckCircle2, Layers3, Smartphone } from "lucide-react";

export function ProductSections() {
  return (
    <AnimatedSection id="product" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-spotly-700">Product system</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">A complete-feeling customer app, not a landing-page fantasy.</h2>
            <p className="mt-5 text-lg font-medium leading-8 text-slateSoft">The website is structured to stay aligned with the SwiftUI app: same launch categories, same booking/order intent, same clean commercial design direction.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {appFeatures.map((feature) => (
              <div key={feature.title} className="rounded-panel border border-line bg-paper p-6">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-spotly-700 text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-black text-ink">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slateSoft">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {screenCards.map((screen) => (
            <div key={screen.title} className="group rounded-panel border border-line bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-soft">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-spotly-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-spotly-700">{screen.eyebrow}</span>
                <ArrowUpRight className="h-5 w-5 text-slateSoft transition group-hover:text-spotly-700" />
              </div>
              <div className="my-8 flex h-28 items-center justify-center rounded-3xl bg-gradient-to-br from-spotly-50 to-white ring-1 ring-line">
                {screen.title === "Home" ? <Smartphone className="h-10 w-10 text-spotly-700" /> : <Layers3 className="h-10 w-10 text-spotly-700" />}
              </div>
              <h3 className="text-2xl font-black text-ink">{screen.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slateSoft">{screen.description}</p>
            </div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}
