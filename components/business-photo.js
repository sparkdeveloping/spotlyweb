"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { marketplaceMedia, marketplaceFallbackMedia } from "@/lib/marketplace-editorial";
import { cn } from "@/lib/cn";

/** One photograph, crop and recovery path across every business surface. */
export function BusinessPhoto({ business = {}, media: assignedMedia, sizes = "(max-width: 640px) 100vw, 420px", priority = false, labelMode = "text", className = "" }) {
  const [failed, setFailed] = useState([]);
  const selected = assignedMedia?.src ? assignedMedia : marketplaceMedia(business);
  const fallback = marketplaceFallbackMedia(business);
  const candidates = [selected, fallback, { ...fallback, src: fallback.largeSrc, srcSet: "" }].filter((item, index, items) => item.src && items.findIndex((other) => other.src === item.src) === index);
  const media = candidates.find((item) => !failed.includes(item.src));
  const illustrative = media?.kind === "editorial";
  const description = illustrative ? `Illustrative ${media.subject || "business"} photograph; not a photograph of this specific business or branch.` : media?.kind === "licensed-directory" ? `Photo of ${business.name || "this business"}, supplied by The Menu.` : `Photo of ${business.name || "this business"}.`;

  return <>
    {media ? <img
      src={media.src}
      srcSet={media.srcSet || undefined}
      sizes={media.srcSet ? sizes : undefined}
      alt={illustrative ? `Illustrative ${media.subject || "business"} photograph` : `Photo of ${business.name || "this business"}`}
      title={description}
      width={1536}
      height={1024}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      onError={() => setFailed((previous) => previous.includes(media.src) ? previous : [...previous, media.src])}
      className={cn("business-photo object-cover", className)}
      style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", maxWidth: "none", objectFit: "cover", objectPosition: media.position || "50% 50%" }}
      data-business-photo={media.family || media.kind}
    /> : <span className="absolute inset-0 bg-[var(--surface-2)]" aria-label="Photograph temporarily unavailable" />}
    {media && labelMode !== "none" && illustrative ? <span className={cn("absolute bottom-2 right-2 z-[1] inline-flex items-center justify-center gap-1.5 rounded-full bg-black/65 text-white shadow-sm backdrop-blur-sm", labelMode === "icon" ? "h-6 w-6" : "px-2.5 py-1.5 text-[10px] font-medium")} title={description} aria-label={description}>
      <Info className="h-3 w-3 shrink-0" aria-hidden="true" />{labelMode === "text" ? "Illustrative photo" : null}
    </span> : null}
    {media?.kind === "licensed-directory" && labelMode !== "none" ? <span className="absolute bottom-2 right-2 z-[1] rounded-full bg-black/65 px-2.5 py-1.5 text-[10px] font-medium text-white" title={description}>Photo: The Menu</span> : null}
  </>;
}
