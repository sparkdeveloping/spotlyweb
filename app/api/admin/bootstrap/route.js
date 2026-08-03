import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function allowedEmails() {
  return new Set(
    (process.env.BOOTSTRAP_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    const email = actor.email?.toLowerCase();
    if (!email || !allowedEmails().has(email)) {
      throw Object.assign(new Error("This email is not in the server-side administrator bootstrap allowlist."), { status: 403 });
    }

    const { db } = getAdminServices();
    const existing = await db.collection("users").where("roles", "array-contains", "super_admin").limit(1).get();
    const alreadySuperAdmin = actor.profile?.roles?.includes("super_admin");
    if (!existing.empty && !alreadySuperAdmin) {
      throw Object.assign(new Error("A super administrator already exists. Assign further roles from Spotly Admin."), { status: 409 });
    }

    const userRef = db.collection("users").doc(actor.uid);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const current = snapshot.exists ? snapshot.data() : {};
      transaction.set(userRef, {
        email: actor.email || current.email || "",
        displayName: actor.name || current.displayName || "",
        roles: [...new Set([...(current.roles || ["customer"]), "super_admin"])],
        customPermissions: ["*"],
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid
      }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "admin.bootstrap",
        entityType: "user",
        entityId: actor.uid,
        actorId: actor.uid,
        actorEmail: actor.email || "",
        metadata: { method: "server_allowlist" },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return Response.json({ ok: true, role: "super_admin" });
  } catch (error) {
    return apiError(error);
  }
}
