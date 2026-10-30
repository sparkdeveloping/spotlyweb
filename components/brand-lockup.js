import Image from "next/image";
import { cn } from "@/lib/cn";

/** Exact approved source vectors, selected by the same CSS theme as the page. */
export function BrandLockup({ asset = "primary", alt = "Spotly", width = 900, height = 340, priority = false, className }) {
  return <span className={cn("experience-brand-lockup", className)} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
    <Image src={`/api/branding/assets/${asset}_horizontal_on_light.svg`} alt="" aria-hidden="true" width={width} height={height} priority={priority} unoptimized className="experience-logo-light" />
    <Image src={`/api/branding/assets/${asset}_horizontal_on_dark.svg`} alt="" aria-hidden="true" width={width} height={height} priority={priority} unoptimized className="experience-logo-dark" />
  </span>;
}
