import { FieldValue } from "firebase-admin/firestore";
import { spotlyAdmin } from "./admin.js";

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered"
]);

export async function sendUserPush({ userId, title, body, data = {}, workspace = "customer" }) {
  if (!userId || !title) return { sent: 0, failed: 0 };
  const { firestore, messaging } = spotlyAdmin();
  const snapshot = await firestore.collection("pushTokens").where("userId", "==", userId).where("active", "==", true).limit(500).get();
  const records = snapshot.docs
    .map((doc) => ({ ref: doc.ref, ...doc.data() }))
    .filter((item) => item.token && item.workspace === workspace);
  const unique = [];
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.token)) continue;
    seen.add(record.token);
    unique.push(record);
  }
  if (!unique.length) return { sent: 0, failed: 0 };

  const response = await messaging.sendEachForMulticast({
    tokens: unique.map((item) => item.token),
    notification: { title, body: body || "" },
    data: {
      workspace,
      ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]))
    }
  });

  const invalid = [];
  response.responses.forEach((result, index) => {
    if (!result.success && INVALID_TOKEN_CODES.has(result.error?.code)) invalid.push(unique[index].ref);
  });
  await Promise.all(invalid.map((ref) => ref.set({ active: false, invalidatedAt: FieldValue.serverTimestamp() }, { merge: true })));
  return { sent: response.successCount, failed: response.failureCount };
}
