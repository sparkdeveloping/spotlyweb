import Image from "next/image";
import { AnimatedSection } from "./AnimatedSection";

export function BlueprintBlock() {
  return (
    <AnimatedSection className="bg-ink py-24 text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-spotly-300">Dev identity</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Designed as an app ecosystem, not just one screen.</h2>
          <p className="mt-5 text-lg font-medium leading-8 text-white/66">The project now has a customer app, a brand mark, a blueprint-style dev identity, and this web layer to keep product storytelling aligned with the current build.</p>
          <div className="mt-8 grid gap-3 text-sm font-bold text-white/72 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">SwiftUI customer app</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Next.js website</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Launch partner demos</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">2026 rollout story</div>
          </div>
        </div>
        <div className="rounded-panel border border-white/10 bg-white/5 p-3 shadow-soft">
          <div className="relative aspect-square overflow-hidden rounded-[1.65rem] bg-spotly-950">
            <Image src="/spotly-blueprint.png" alt="Spotly blueprint logo" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
