import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { getBusinessPortfolio } from "@/lib/business-portfolio-server";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const portfolio = await getBusinessPortfolio(db, user);
    return Response.json({ ok: true, ...portfolio });
  } catch (error) {
    return apiError(error);
  }
}
