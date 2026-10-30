"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { serviceIdentity, SERVICE_IDENTITIES } from "@/lib/service-identity";
import { publicProductRoute } from "@/lib/spotly-products";
import { ServiceArtwork, ServiceGlyph } from "@/components/service-artwork";
import { BrandLockup } from "@/components/brand-lockup";

export function ServiceIdentity({ service, className, decorative = false }) {
  const identity = serviceIdentity(service);
  return <BrandLockup asset={identity.asset} alt={decorative ? "" : identity.name} width={760} height={250} className={cn("experience-identity", className)} />;
}

function navigate(event, handler, service) {
  if (!handler || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  handler(service);
}

export function ServiceSwitcher({ service, onSelectService, onHome }) {
  return <nav aria-label="Spotly services" className="experience-service-switcher no-scrollbar">
    <Link href="/" className="experience-service-home" onClick={(event) => navigate(event, onHome)}><ArrowLeft aria-hidden="true" className="h-4 w-4" /><span>Home</span></Link>
    <span className="experience-service-divider" aria-hidden="true" />
    {Object.entries(SERVICE_IDENTITIES).map(([key, identity]) => <Link key={key} href={publicProductRoute(key)} aria-current={service === key ? "page" : undefined} data-service={key} onClick={(event) => navigate(event, onSelectService, key)}>
      <ServiceGlyph service={key} className="h-4 w-4" />{identity.label}
    </Link>)}
  </nav>;
}

/** Identity and real task controls share one entrance; no interstitial splash screen. */
export function ServiceEntrance({ service, title, description, eyebrow, children, compact = false, status }) {
  return <section data-service={service} className={cn("experience-service-hero", compact && "experience-service-hero-compact")}>
    <div className="experience-service-copy">
      <div className="experience-service-brand"><ServiceIdentity service={service} />{status ? <span className="experience-service-status">{status}</span> : null}</div>
      {eyebrow ? <p className="experience-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p className="experience-service-description">{description}</p> : null}
      {children ? <div className="experience-service-task">{children}</div> : null}
    </div>
    <div className="experience-service-scene" aria-hidden="true"><span className="experience-scene-orbit" /><ServiceArtwork service={service} priority /></div>
  </section>;
}
