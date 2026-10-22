import snapshot from "@/data/themenu/image-candidates-2026-10-21.json";
import { authenticateRequest, apiError } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeTheMenuUrl, theMenuRestaurantInfo } from "@/lib/themenu-image-extractor";

export const runtime = "nodejs";
const roles = ["super_admin","platform_admin","operations_manager","data_import_manager","content_manager"];
const candidates = [
  ...snapshot.listingCandidates.map(item => ({ name: item.name, sourcePage: item.sourcePage })),
  ...snapshot.detailedPages.map(item => ({ name: item.restaurant, sourcePage: item.sourcePage }))
].filter((item, index, all) => all.findIndex(other => other.sourcePage === item.sourcePage) === index);

/** Admin-only source inspection; deliberately NO Firestore write or media publication. */
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request, { roles });
    await enforceRateLimit(request,{ key:"themenu_image_review",limit:30,windowMs:60_000,identity:actor.uid });
    const sourcePage = new URL(request.url).searchParams.get("page") || "";
    if (!sourcePage) return Response.json({ ok:true, candidates },{headers:{"Cache-Control":"private, no-store"}});
    if (!candidates.some(item => item.sourcePage === sourcePage) || !safeTheMenuUrl(sourcePage))
      return Response.json({ ok:false,error:"Select one of the approved catalog source pages." },{status:400});
    const response = await fetch(sourcePage,{
      redirect:"error", signal:AbortSignal.timeout(10000),
      headers:{"Accept":"text/html","User-Agent":"SpotlyAfrica/1.0 (editorial review; business@spotlyafrica.com)"}
    });
    if(!response.ok || !/text\/html/i.test(response.headers.get("content-type")||""))
      throw Object.assign(new Error("The Menu source is temporarily unavailable."),{status:502});
    const html = await response.text();
    if (html.length > 1_500_000) throw Object.assign(new Error("Source page exceeds the review size limit."),{status:502});
    const record=theMenuRestaurantInfo(html,sourcePage);
    if (!record) throw Object.assign(new Error("Cannot read this restaurant page."),{status:502});
    return Response.json({ok:true,record},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return apiError(error); }
}
