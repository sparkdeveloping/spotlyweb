import { z } from "zod";

const LeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  business: z.string().trim().max(140).optional().default(""),
  message: z.string().trim().min(10).max(2000),
  portal: z.enum(["customer", "business", "driver", "admin"]).optional().default("customer")
});

export async function POST(request) {
  try {
    const payload = LeadSchema.parse(await request.json());
    const webhook = process.env.LEAD_WEBHOOK_URL;

    if (webhook) {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, receivedAt: new Date().toISOString(), source: "spotly-web" }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: "Invalid request", issues: error.issues }, { status: 400 });
    }
    console.error("Lead API error", error);
    return Response.json({ ok: false, error: "Unable to process request" }, { status: 500 });
  }
}
