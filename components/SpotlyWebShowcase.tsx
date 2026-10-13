"use client";

import Image from "next/image";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { CalendarDays, CarFront, Package, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import clsx from "clsx";

type ServiceKey = "ride" | "eat" | "shop" | "book" | "events" | "send";

type Service = {
  key: ServiceKey;
  label: string;
  title: string;
  description: string;
  task: string;
  highlights: string[];
  icon: ComponentType<{ className?: string }>;
  accent: string;
  preview: string;
};

const services: Service[] = [
  {
    key: "ride",
    label: "Ride",
    title: "Get moving in seconds",
    description:
      "As soon as someone chooses Ride, the expressive home transforms into a focused trip surface with destination search, shortcuts, and recent places.",
    task: "Where to?",
    highlights: ["Fast destination entry", "Home, Work, Airport shortcuts", "Recent places and scheduled rides"],
    icon: CarFront,
    accent: "from-violet-600 to-indigo-500",
    preview: "/preview-ride.png"
  },
  {
    key: "eat",
    label: "Eat",
    title: "Food discovery without clutter",
    description:
      "Eat should feel delicious and useful: repeat orders, restaurant discovery, and a clear search pattern instead of a noisy dashboard.",
    task: "What are you craving?",
    highlights: ["Search dishes or restaurants", "Order-again memory", "Reliable nearby picks"],
    icon: UtensilsCrossed,
    accent: "from-orange-600 to-amber-500",
    preview: "/preview-home.png"
  },
  {
    key: "shop",
    label: "Shop",
    title: "A marketplace that feels calm",
    description:
      "Shopping lives in the same system: familiar service switching, product-first discovery, and fast paths to repeat essentials.",
    task: "What are you looking for?",
    highlights: ["Product and store search", "Repeat essentials", "Nearby stock and storefronts"],
    icon: ShoppingBag,
    accent: "from-emerald-700 to-teal-500",
    preview: "/preview-home.png"
  },
  {
    key: "book",
    label: "Book",
    title: "Services with real availability",
    description:
      "Bookings should feel lightweight and trustworthy, whether the customer wants a haircut, massage, padel court, or health appointment.",
    task: "What would you like to book?",
    highlights: ["Availability-led discovery", "Service-first search", "Fewer steps to confirm"],
    icon: Sparkles,
    accent: "from-sky-700 to-blue-500",
    preview: "/preview-home.png"
  },
  {
    key: "events",
    label: "Events",
    title: "See what is happening this week",
    description:
      "Events live naturally in Spotly: discover what is on tonight, save plans, and move from browsing to booking without leaving the product.",
    task: "What’s happening?",
    highlights: ["Tonight and weekend filters", "Event-led discovery", "Integrated booking path"],
    icon: CalendarDays,
    accent: "from-fuchsia-700 to-violet-500",
    preview: "/preview-activity.png"
  },
  {
    key: "send",
    label: "Send",
    title: "Simple person-to-person delivery",
    description:
      "Send uses the same language as Ride: choose pickup and destination, confirm, and track progress with clarity.",
    task: "Send something",
    highlights: ["Clear from/to structure", "Recent recipients", "Tracking continuity"],
    icon: Package,
    accent: "from-amber-700 to-orange-500",
    preview: "/preview-search.png"
  }
];

export function SpotlyWebShowcase() {
  const [selected, setSelected] = useState<ServiceKey>("ride");
  const service = useMemo(() => services.find((item) => item.key === selected) ?? services[0], [selected]);
  const Icon = service.icon;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,420px)] lg:items-center">
      <div>
        <div className="mb-5 flex flex-wrap gap-2">
          {services.map((item) => {
            const ItemIcon = item.icon;
            const active = item.key === selected;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelected(item.key)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-transparent bg-ink text-white shadow-card"
                    : "border-line bg-white/85 text-slate-700 hover:border-slate-300 hover:bg-white"
                )}
              >
                <ItemIcon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-[28px] border border-line bg-white p-6 shadow-card md:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className={clsx("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white", service.accent)}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Service mode</p>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">{service.title}</h3>
            </div>
          </div>

          <p className="max-w-xl text-[15px] leading-7 text-slate-600">{service.description}</p>

          <div className="mt-6 rounded-3xl border border-line bg-slate-50/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Primary task</p>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/5">
              <div>
                <p className="text-base font-semibold tracking-tight text-ink">{service.task}</p>
                <p className="text-sm text-slate-500">One clear action replaces the larger home tiles after selection.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Focused</div>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {service.highlights.map((highlight) => (
              <li key={highlight} className="rounded-2xl border border-line bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[420px] rounded-[32px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-soft">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Preview</p>
              <p className="text-lg font-semibold tracking-tight text-ink">{service.label} on Spotly Web</p>
            </div>
            <div className={clsx("rounded-full bg-gradient-to-br px-3 py-1 text-xs font-semibold text-white", service.accent)}>
              {service.label}
            </div>
          </div>
          <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-100">
            <Image
              src={service.preview}
              alt={`${service.label} preview`}
              width={240}
              height={740}
              className="h-auto w-full"
              priority={service.key === "ride"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
