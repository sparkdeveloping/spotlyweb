import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { getBusinessPortfolio } from "@/lib/business-portfolio-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const portfolio = await getBusinessPortfolio(db, user);
    return Response.json({ ok: true, ...portfolio }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return apiError(error);
  }
}
