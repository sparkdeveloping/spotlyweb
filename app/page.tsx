import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  LocateFixed,
  Package,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  UtensilsCrossed
} from "lucide-react";
import { SpotlyWebShowcase } from "../components/SpotlyWebShowcase";

const services = [
  {
    title: "Ride",
    body: "The fastest path in the system. Destination first, then clarity all the way through pickup and trip progress.",
    icon: CarFront,
    accent: "from-violet-600 to-indigo-500"
  },
  {
    title: "Eat",
    body: "Dishes, restaurants, repeat orders, and better food discovery without a noisy home screen.",
    icon: UtensilsCrossed,
    accent: "from-orange-600 to-amber-500"
  },
  {
    title: "Shop",
    body: "Products, nearby stock, and everyday essentials in a marketplace that still feels calm.",
    icon: ShoppingBag,
    accent: "from-emerald-700 to-teal-500"
  },
  {
    title: "Book",
    body: "Haircuts, wellness, appointments, and lifestyle bookings with a cleaner availability-first model.",
    icon: Sparkles,
    accent: "from-sky-700 to-blue-500"
  },
  {
    title: "Events",
    body: "Find what is happening tonight or this weekend, save it, and resolve into action from the same product.",
    icon: CalendarDays,
    accent: "from-fuchsia-700 to-violet-500"
  },
  {
    title: "Send",
    body: "A simple city logistics flow for deliveries between people, powered by the same Spotly system.",
    icon: Package,
    accent: "from-amber-700 to-orange-500"
  }
];

const principles = [
  {
    title: "Expressive first screen",
    body: "Home starts as a rich launcher, not a dull control panel. Customers understand the breadth of Spotly immediately.",
    icon: Sparkles
  },
  {
    title: "Focused service mode",
    body: "Once someone picks Ride, Eat, Shop, Book, Events, or Send, the interface narrows to one clear next step.",
    icon: LocateFixed
  },
  {
    title: "One design system everywhere",
    body: "The same language can scale across iOS, web, business, driver, admin, and eventual ridesharing flows.",
    icon: ShieldCheck
  }
];

const buildPoints = [
  "Updated landing page aligned to the Spotly 2.0 direction",
  "Interactive service-mode showcase for web review",
  "Preview imagery from the latest customer prototype",
  "Ready for your agents to continue into deeper implementation"
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-heroGlow opacity-90" />
        <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_top_right,rgba(102,87,217,0.16),transparent_32%),radial-gradient(circle_at_10%_20%,rgba(13,147,84,0.14),transparent_28%)]" />

        <header className="relative z-10 border-b border-black/5 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
            <Link href="#top" className="flex items-center gap-3">
              <Image src="/spotly-mark.svg" alt="Spotly" width={40} height={40} />
              <div>
                <div className="text-lg font-semibold tracking-tight">Spotly</div>
                <div className="text-xs text-slateSoft">Web 2.0 direction</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <a href="#experience" className="transition hover:text-ink">Experience</a>
              <a href="#services" className="transition hover:text-ink">Services</a>
              <a href="#principles" className="transition hover:text-ink">Principles</a>
              <a href="#launch" className="transition hover:text-ink">Launch</a>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <a href="#experience" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white">
                Review direction
              </a>
              <a href="#launch" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:translate-y-[-1px]">
                Continue build
              </a>
            </div>
          </div>
        </header>

        <section id="top" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-12 lg:px-8 lg:pb-24 lg:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-sm font-medium text-violet-700 backdrop-blur">
                <Clock3 className="h-4 w-4" />
                Spotly 2.0 · customer, web, and launch direction
              </div>

              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] text-ink sm:text-6xl lg:text-7xl">
                One city app, <span className="text-violet-700">properly designed.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 lg:text-xl">
                This updated Spotly web direction turns the new customer prototype into a cleaner public-facing product: a richer home, faster service selection, clearer ride flows, stronger marketplace messaging, and a visual system that feels calm instead of improvised.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#experience" className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(102,87,217,0.28)] transition hover:bg-violet-800">
                  See the experience
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#launch" className="inline-flex items-center gap-2 rounded-full border border-line bg-white/90 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                  View production notes
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Products", value: "Ride · Eat · Shop · Book · Events · Send" },
                  { label: "Interface model", value: "Expressive home → focused service mode" },
                  { label: "Output", value: "Launch-ready marketing + product direction" }
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-card backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="absolute -inset-6 rounded-[40px] bg-[radial-gradient(circle,rgba(102,87,217,0.18),transparent_58%)] blur-2xl" />
              <div className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between rounded-[22px] border border-slate-200 bg-white/90 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Customer preview</p>
                    <p className="text-lg font-semibold tracking-tight">Spotly 2.0 prototype screens</p>
                  </div>
                  <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Updated</div>
                </div>
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#eef1f6]">
                  <Image
                    src="/spotly-customer-preview.png"
                    alt="Spotly customer app preview"
                    width={1536}
                    height={1024}
                    priority
                    className="h-auto w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="experience" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-700">Experience model</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">The web version follows the same product logic as the new prototype.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            The goal is not to imitate a random marketplace. The goal is to make Spotly feel distinct, trustworthy, and fast: attractive on first contact, then highly focused once someone chooses what they want to do.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-card">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight">1. Attractive default home</h3>
            <p className="mt-4 leading-7 text-slate-600">
              Customers land on a visually rich home with strong service tiles, repeat actions, nearby discovery, and a calmer editorial feel.
            </p>
          </div>
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-card">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ArrowRight className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight">2. Intent becomes clear</h3>
            <p className="mt-4 leading-7 text-slate-600">
              The moment someone chooses Ride, Eat, Shop, Book, Events, or Send, the big tile canvas disappears and the interface becomes task-led.
            </p>
          </div>
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-card">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight">3. Completion gets easier</h3>
            <p className="mt-4 leading-7 text-slate-600">
              This approach improves clarity, lowers decision friction, and gives Spotly room to scale into ridesharing, commerce, and services.
            </p>
          </div>
        </div>

        <div className="mt-14">
          <SpotlyWebShowcase />
        </div>
      </section>

      <section id="services" className="border-y border-line bg-white/70">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
          <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-700">Service architecture</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">A system that can hold the full Spotly universe.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Each service has its own personality, but the overall language stays unified. That consistency is what makes Spotly easier to learn and easier to trust.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="rounded-[28px] border border-line bg-white p-6 shadow-card">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${service.accent} text-white`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight">{service.title}</h3>
                  <p className="mt-4 leading-7 text-slate-600">{service.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="principles" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-700">Design principles</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
              What makes this direction stronger than the old site and stronger than a shallow UI refresh.
            </h2>

            <div className="mt-10 grid gap-5">
              {principles.map((principle) => {
                const Icon = principle.icon;
                return (
                  <article key={principle.title} className="rounded-[28px] border border-line bg-white p-6 shadow-card">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-semibold tracking-tight">{principle.title}</h3>
                    <p className="mt-4 leading-7 text-slate-600">{principle.body}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-line bg-white p-8 shadow-card">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-700">Why it matters</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">This is not just a marketing website.</h3>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              It becomes the public expression of the broader Spotly system. The web direction should help your team make better iOS, business, driver, admin, and ridesharing decisions too.
            </p>

            <div className="mt-8 space-y-4">
              {[
                "Clarifies the product story for customers, businesses, and investors",
                "Gives your implementation agents a visual and structural reference",
                "Creates a cleaner bridge between prototype work and production code",
                "Lets Spotly feel more premium without becoming overly artificial"
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-4">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="launch" className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-300">Production handoff</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">What this updated web build is meant to do next.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Use this as the new reference point for the Spotly website while your agents continue implementation. The structure is now aligned to the stronger product model instead of the older, flatter marketing story.
            </p>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="grid gap-4">
                {buildPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-200">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium leading-6 text-slate-200">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-violet-300">Next priorities</p>
            <div className="mt-6 space-y-4">
              {[
                ["1", "Carry the same language into the real web product shell and app marketing pages."],
                ["2", "Replace placeholder/preview imagery with final branded screens and photography as the app UI stabilizes."],
                ["3", "Extend the same interaction model into business, driver, admin, and eventual ridesharing surfaces."],
                ["4", "Refine copy, SEO metadata, forms, and partner onboarding flows on top of this direction."],
              ].map(([step, text]) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">{step}</div>
                  <p className="text-sm leading-6 text-slate-200">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#top" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-100">
                Back to top
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#services" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5">
                Review service architecture
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/spotly-mark.svg" alt="Spotly" width={30} height={30} />
            <span>Spotly · Zimbabwe’s city-life super app in progress.</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <span className="inline-flex items-center gap-2"><Store className="h-4 w-4" /> Businesses</span>
            <span className="inline-flex items-center gap-2"><CarFront className="h-4 w-4" /> Driver & ridesharing</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Admin & ops</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
