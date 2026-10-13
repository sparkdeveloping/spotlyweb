"use client";

import { useState } from "react";
import { ImagePlus, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { selectClass } from "@/components/business/shared";

const modes = [
  ["clean_background", "Clean background"],
  ["improve_lighting", "Improve lighting"],
  ["straighten_crop", "Straighten and crop"],
  ["professional_product", "Professional product image"],
  ["transparent_background", "Transparent background"]
];

export function ProductImageEnhancement({ businessId, productId, originalUrl, sourceStoragePath, onUseImage }) {
  const [mode, setMode] = useState("clean_background");
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(null);
  const [approving, setApproving] = useState(false);
  const { toast } = useToast();
  if (!originalUrl || !sourceStoragePath) return null;

  async function enhance() {
    setEnhancing(true); setEnhanced(null);
    try {
      const result = await authenticatedFetch("/api/business/media/enhance-product", { method: "POST", body: JSON.stringify({ businessId, ...(productId ? { productId } : {}), sourceStoragePath, mode }) });
      setEnhanced(result.imageVersion);
    } catch (error) { toast(error.message || "Your original image is safe. Try again or use it as-is.", { type: "error", title: "Image enhancement failed" }); }
    finally { setEnhancing(false); }
  }
  async function useEnhanced() {
    if (!enhanced) return;
    setApproving(true);
    try {
      const result = await authenticatedFetch("/api/business/media/approve-product-image", { method: "POST", body: JSON.stringify({ businessId, ...(productId ? { productId } : {}), imageVersionId: enhanced.id, decision: "approve" }) });
      const image = result.image || { url: enhanced.url, storagePath: enhanced.storagePath, imageVersionId: enhanced.id, model: enhanced.model, sourceStoragePath };
      onUseImage({ image: image.url, imageStoragePath: image.storagePath, imageVersionId: image.imageVersionId, imageRightsStatus: "merchant_owned", imageSourceType: "merchant_owned", imageProvenance: { type: "ai_enhanced", sourceStoragePath: image.sourceStoragePath || sourceStoragePath, imageVersionId: image.imageVersionId, model: image.model || enhanced.model || "" } });
      toast("Enhanced image selected. The original is still stored separately.", { title: "Image approved" });
    } catch (error) { toast(error.message, { type: "error", title: "Could not approve image" }); }
    finally { setApproving(false); }
  }

  return <Card variant="bordered" className="mt-4 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-business-soft text-business"><Sparkles className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Enhance with Spotly</p><p className="mt-1 text-xs leading-5 text-secondary">Keep packaging factual. Spotly stores the original and lets you approve the edited version.</p></div></div><div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end"><select className={`${selectClass} sm:max-w-[220px]`} value={mode} onChange={(event) => setMode(event.target.value)}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button type="button" variant="outline" onClick={enhance} loading={enhancing}><Sparkles className="h-4 w-4" />Enhance</Button></div></div>{enhanced && <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2"><div><div className="mb-2 flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Original</p><Badge tone="neutral">Source of truth</Badge></div><div className="aspect-square overflow-hidden rounded-xl bg-grouped"><span role="img" aria-label="Original product" className="block h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${originalUrl})` }} /></div></div><div><div className="mb-2 flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Enhanced</p><Badge tone="purple">AI-assisted</Badge></div><div className="aspect-square overflow-hidden rounded-xl bg-grouped"><span role="img" aria-label="Enhanced product" className="block h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${enhanced.url})` }} /></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={useEnhanced} loading={approving}><ImagePlus className="h-4 w-4" />Use enhanced</Button><Button type="button" variant="outline" onClick={() => setEnhanced(null)}>Use original</Button><Button type="button" variant="ghost" onClick={enhance} disabled={enhancing}>Try again</Button></div></div></div>}</Card>;
}
