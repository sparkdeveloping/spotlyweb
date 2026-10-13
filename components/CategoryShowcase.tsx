import { CalendarDays, HeartPulse, MoreHorizontal, Scissors, ShoppingBasket, Sparkles, Stethoscope, Store, Ticket, Utensils } from "lucide-react";
import { topCategories, categories } from "@/data/site";
import { AnimatedSection } from "./AnimatedSection";

const iconMap = {
  Food: Utensils,
  Groceries: ShoppingBasket,
  Events: CalendarDays,
  Activities: Sparkles
};

const smallIcons = [Utensils, Store, ShoppingBasket, Ticket, HeartPulse, Stethoscope, Scissors, Sparkles, MoreHorizontal];

export function CategoryShowcase() {
  return (
    <AnimatedSection id="categories" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-spotly-700">Categories</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">Built around the city’s real reasons to open the app.</h2>
        <p className="mt-5 text-lg font-medium leading-8 text-slateSoft">The website mirrors the app’s new cleaner priority: food, groceries, and events first, with a full category hub underneath.</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {topCategories.map((item) => {
          const Icon = iconMap[item.title as keyof typeof iconMap];
          return (
            <div key={item.title} className="rounded-panel border border-line bg-white p-6 shadow-card">
              <div className={`flex h-16 w-16 items-center justify-center rounded-[1.35rem] ${item.accent}`}>
                <Icon className="h-8 w-8" />
              </div>
              <h3 className="mt-6 text-2xl font-black text-ink">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slateSoft">{item.subtitle}</p>
              <p className="mt-5 inline-flex rounded-full bg-spotly-50 px-3 py-1 text-xs font-black text-spotly-700">{item.count}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-10 rounded-panel border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap gap-3">
          {categories.map((category, index) => {
            const Icon = smallIcons[index % smallIcons.length];
            return (
              <span key={category} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-black text-ink">
                <Icon className="h-4 w-4 text-spotly-700" /> {category}
              </span>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
}
