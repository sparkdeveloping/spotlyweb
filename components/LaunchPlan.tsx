import { launchSteps } from "@/data/site";
import { AnimatedSection } from "./AnimatedSection";
import { ArrowRight, Check } from "lucide-react";

export function LaunchPlan() {
  return (
    <AnimatedSection id="launch" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
      <div className="overflow-hidden rounded-[2.4rem] border border-line bg-white shadow-soft">
        <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="bg-spotly-800 p-8 text-white sm:p-12">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-spotly-200">Launch 2026</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">The website stays caught up with the app’s current direction.</h2>
            <p className="mt-5 text-base font-medium leading-7 text-white/70">Use this as a public-facing, demo-facing, or investor-facing shell while the SwiftUI build keeps advancing.</p>
            <a href="mailto:hello@spotly.app" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-spotly-800">
              Contact Spotly <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="p-8 sm:p-12">
            <div className="space-y-4">
              {launchSteps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-line bg-paper p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-spotly-700 text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-bold leading-6 text-ink">{step}</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-black text-spotly-700">
                      <Check className="h-3.5 w-3.5" /> tracked in roadmap
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
