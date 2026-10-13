import { z } from "zod";
import { apiError, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

const LeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  business: z.string().trim().max(140).optional().default(""),
  message: z.string().trim().min(10).max(2000),
  portal: z.enum(["customer", "business", "driver", "admin"]).optional().default("customer")
});

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    await enforceRateLimit(request, { key: "public-lead", limit: 5, windowMs: 30 * 60_000 });
    const payload = LeadSchema.parse(await request.json());
    const webhook = process.env.LEAD_WEBHOOK_URL;

    if (webhook) {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, receivedAt: new Date().toISOString(), source: "spotly-web" }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw Object.assign(new Error("The support intake service is temporarily unavailable."), { status: 503 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: "Invalid request", issues: error.issues }, { status: 400 });
    }
    return apiError(error);
  }
}
