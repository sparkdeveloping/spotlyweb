import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["welcome", "claim_received", "claim_update", "support_reply", "business_invitation", "order_update"]),
  to: z.string().email(),
  subject: z.string().min(3).max(140).optional(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function template(type, data) {
  const name = escapeHtml(data.name || "there");
  const templates = {
    welcome: {
      subject: "Welcome to Spotly",
      heading: `Welcome, ${name}`,
      body: "Your Spotly account is ready. You can now join the launch list, claim a business, and manage your account from one place.",
      action: "Open Spotly",
      href: "/account"
    },
    claim_received: {
      subject: "We received your Spotly business claim",
      heading: "Your claim is in review",
      body: `We received your claim for ${escapeHtml(data.businessName || "your business")}. You can continue preparing the profile while our team verifies the information.`,
      action: "View claim status",
      href: "/business"
    },
    claim_update: {
      subject: `Business claim ${escapeHtml(data.status || "update")}`,
      heading: "Your claim status changed",
      body: escapeHtml(data.message || "Open Spotly to review the latest verification update."),
      action: "Review update",
      href: "/business"
    },
    support_reply: {
      subject: "Spotly support replied",
      heading: "You have a new support reply",
      body: escapeHtml(data.message || "A support agent replied to your conversation."),
      action: "Open support",
      href: "/support"
    },
    business_invitation: {
      subject: `You were invited to ${escapeHtml(data.businessName || "a Spotly business")}`,
      heading: "Business team invitation",
      body: `${escapeHtml(data.inviterName || "A business owner")} invited you to join ${escapeHtml(data.businessName || "their business")} on Spotly.`,
      action: "Accept invitation",
      href: `/business?invitation=${encodeURIComponent(data.invitationId || "")}`
    },
    order_update: {
      subject: `Order ${escapeHtml(data.orderNumber || "")} update`,
      heading: `Your order is ${escapeHtml(data.status || "updated")}`,
      body: escapeHtml(data.message || "Open Spotly for the latest pickup information."),
      action: "View order",
      href: `/marketplace?order=${encodeURIComponent(data.orderId || "")}`
    }
  };
  return templates[type];
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const roles = new Set(user.profile?.roles || []);
    let canSendToOthers = roles.has("super_admin") || roles.has("admin") || roles.has("platform_admin") || roles.has("content_manager");
    if (!canSendToOthers && body.type === "business_invitation" && body.data.invitationId) {
      const invitation = await db.collection("businessInvitations").doc(String(body.data.invitationId)).get();
      const values = invitation.exists ? invitation.data() : null;
      canSendToOthers = Boolean(values && values.invitedBy === user.uid && String(values.email || "").toLowerCase() === body.to.toLowerCase());
    }
    if (body.to.toLowerCase() !== user.email?.toLowerCase() && !canSendToOthers) {
      throw Object.assign(new Error("You cannot send this notification."), { status: 403 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "Spotly <onboarding@resend.dev>";
    if (!apiKey) throw Object.assign(new Error("Email delivery is not configured yet."), { status: 503 });

    const content = template(body.type, body.data);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const href = `${baseUrl}${content.href}`;
    const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#16161d"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e9e9ef;border-radius:22px;padding:32px"><div style="font-size:22px;font-weight:800;color:#6657d9">Spotly</div><h1 style="font-size:28px;line-height:1.15;margin:28px 0 12px">${content.heading}</h1><p style="font-size:16px;line-height:1.7;color:#5f6070;margin:0 0 26px">${content.body}</p><a href="${href}" style="display:inline-block;background:#6657d9;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:12px">${content.action}</a><p style="font-size:12px;line-height:1.6;color:#9697a3;margin:30px 0 0">This operational message was sent by Spotly. Support contact details are managed from the Spotly admin platform.</p></div></div></body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [body.to], subject: safeText(body.subject || content.subject, 140), html })
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result?.message || "The email provider rejected the message."), { status: 502 });

    await db.collection("emailLogs").add({
      provider: "resend",
      providerId: result.id || "",
      type: body.type,
      to: body.to.toLowerCase(),
      subject: body.subject || content.subject,
      requestedBy: user.uid,
      status: "sent",
      createdAt: FieldValue.serverTimestamp()
    });
    return Response.json({ ok: true, id: result.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The email request is incomplete.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
