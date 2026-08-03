import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const schema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(500),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(240),
  href: z.string().max(500).default("/account"),
  category: z.string().max(60).default("general")
});

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ["super_admin", "admin", "platform_admin", "support_manager", "support_agent"] });
    const body = schema.parse(await request.json());
    const { db, messaging } = getAdminServices();

    const tokenSnapshots = await Promise.all(body.userIds.map((userId) => db.collection("pushTokens").where("userId", "==", userId).where("active", "==", true).limit(20).get()));
    const tokenDocs = tokenSnapshots.flatMap((snapshot) => snapshot.docs);
    const tokenEntries = new Map();
    tokenDocs.forEach((item) => {
      const token = item.data().token;
      if (token && !tokenEntries.has(token)) tokenEntries.set(token, item);
    });
    const tokens = [...tokenEntries.keys()];

    const notificationBatch = db.batch();
    for (const userId of body.userIds) {
      notificationBatch.set(db.collection("notifications").doc(), {
        userId,
        title: body.title,
        body: body.body,
        href: body.href,
        category: body.category,
        read: false,
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp()
      });
    }
    await notificationBatch.commit();

    if (!tokens.length) return Response.json({ ok: true, delivered: 0, stored: body.userIds.length, unavailable: 0 });

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: body.title, body: body.body },
      webpush: { fcmOptions: { link: `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}${body.href}` } },
      data: { href: body.href, category: body.category }
    });

    const staleBatch = db.batch();
    result.responses.forEach((response, index) => {
      if (!response.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.error?.code)) {
        staleBatch.set(tokenEntries.get(tokens[index]).ref, { active: false, invalidatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });
    await staleBatch.commit();

    return Response.json({ ok: true, delivered: result.successCount, unavailable: result.failureCount, stored: body.userIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The notification request is invalid.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
