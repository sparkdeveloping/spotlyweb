import "server-only";

import { FieldValue } from "firebase-admin/firestore";

function safe(value = "", max = 1200) {
  return String(value || "").trim().slice(0, max);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function absoluteUrl(href = "") {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://www.spotlyafrica.com").replace(/\/$/, "");
  if (!href) return base;
  if (/^https?:\/\//i.test(href)) return href;
  return `${base}${href.startsWith("/") ? href : `/${href}`}`;
}

async function sendEmail(db, { to, title, body, href, eventType, userId }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return { status: "not_configured" };
  const from = process.env.RESEND_FROM_EMAIL || "Spotly <onboarding@resend.dev>";
  const actionUrl = absoluteUrl(href);
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#16161d"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e9e9ef;border-radius:22px;padding:32px"><div style="font-size:22px;font-weight:800;color:#6657d9">Spotly</div><h1 style="font-size:27px;line-height:1.2;margin:28px 0 12px">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.7;color:#5f6070;margin:0 0 26px">${escapeHtml(body)}</p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#6657d9;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:12px">Open Spotly</a><p style="font-size:12px;line-height:1.6;color:#9697a3;margin:30px 0 0">This is an operational Spotly notification about activity on your account or workspace.</p></div></div></body></html>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: safe(title, 140), html })
    });
    const result = await response.json().catch(() => ({}));
    await db.collection("emailLogs").add({
      provider: "resend",
      providerId: result?.id || "",
      type: eventType || "operational_notification",
      to: String(to).toLowerCase(),
      subject: safe(title, 140),
      userId,
      status: response.ok ? "sent" : "failed",
      providerMessage: response.ok ? "" : safe(result?.message || "Provider rejected notification", 500),
      createdAt: FieldValue.serverTimestamp()
    });
    return { status: response.ok ? "sent" : "failed", id: result?.id || "" };
  } catch (error) {
    await db.collection("emailLogs").add({
      provider: "resend",
      type: eventType || "operational_notification",
      to: String(to).toLowerCase(),
      subject: safe(title, 140),
      userId,
      status: "failed",
      providerMessage: safe(error?.message || "Email delivery failed", 500),
      createdAt: FieldValue.serverTimestamp()
    }).catch(() => {});
    return { status: "failed" };
  }
}

async function pushForUser(db, messaging, userId, notification) {
  if (!messaging) return { delivered: 0 };
  const snapshot = await db.collection("pushTokens").where("userId", "==", userId).where("active", "==", true).limit(20).get();
  const tokens = [...new Set(snapshot.docs.map((doc) => doc.data().token).filter(Boolean))];
  if (!tokens.length) return { delivered: 0 };
  try {
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: notification.title, body: notification.body },
      data: {
        href: notification.href || "",
        category: notification.category || "general",
        workspace: notification.workspace || "customer",
        eventType: notification.eventType || ""
      }
    });
    return { delivered: result.successCount };
  } catch {
    return { delivered: 0 };
  }
}

async function resolveRecipient(db, auth, userId) {
  const [profileSnapshot, preferenceSnapshot] = await Promise.all([
    db.collection("users").doc(userId).get(),
    db.collection("notificationPreferences").doc(userId).get()
  ]);
  const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
  const preferences = preferenceSnapshot.exists ? preferenceSnapshot.data() : (profile.preferences || {});
  let email = profile.email || "";
  if (!email && auth) {
    try { email = (await auth.getUser(userId)).email || ""; } catch {}
  }
  return { profile, preferences, email };
}

/**
 * Canonical Spotly operational notification dispatcher.
 * In-app persistence is authoritative; push/email are best-effort channels and never roll
 * back the product decision that triggered the notification.
 */
export async function notifyUser({ db, messaging = null, auth = null, userId, title, body, href = "", category = "general", workspace = "customer", module = "general", eventType = "", importance = "normal", businessId = null, entityType = null, entityId = null, email = false, push = true, forceOperationalEmail = false }) {
  if (!db || !userId) return { stored: 0, email: "skipped", push: 0 };
  const recipient = await resolveRecipient(db, auth, userId);
  const notificationRef = db.collection("notifications").doc();
  const record = {
    userId,
    title: safe(title, 180),
    body: safe(body, 1000),
    href: safe(href, 600),
    category: safe(category, 100),
    workspace: safe(workspace, 40) || "customer",
    module: safe(module, 80) || "general",
    eventType: safe(eventType, 120),
    importance: ["low", "normal", "high", "critical"].includes(importance) ? importance : "normal",
    businessId: businessId || null,
    entityType: entityType || null,
    entityId: entityId || null,
    read: false,
    channels: { inApp: "stored", email: email ? "pending" : "disabled", push: push ? "pending" : "disabled" },
    createdAt: FieldValue.serverTimestamp()
  };
  await notificationRef.set(record);

  const operationalEmailAllowed = forceOperationalEmail || recipient.preferences?.emailUpdates !== false;
  const [emailResult, pushResult] = await Promise.all([
    email && operationalEmailAllowed && recipient.email
      ? sendEmail(db, { to: recipient.email, title: record.title, body: record.body, href: record.href, eventType: record.eventType, userId })
      : Promise.resolve({ status: recipient.email ? "disabled" : "no_email" }),
    push ? pushForUser(db, messaging, userId, record) : Promise.resolve({ delivered: 0 })
  ]);

  await notificationRef.set({
    "channels.email": emailResult.status || "disabled",
    "channels.push": push ? (pushResult.delivered ? "sent" : "not_delivered") : "disabled",
    deliveredAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});
  return { stored: 1, email: emailResult.status || "disabled", push: pushResult.delivered || 0, id: notificationRef.id };
}

export async function notifyUsers(options, userIds = []) {
  const unique = [...new Set(userIds.filter(Boolean))];
  const results = await Promise.all(unique.map((userId) => notifyUser({ ...options, userId })));
  return {
    stored: results.reduce((sum, item) => sum + Number(item.stored || 0), 0),
    push: results.reduce((sum, item) => sum + Number(item.push || 0), 0),
    email: results.filter((item) => item.email === "sent").length
  };
}

export async function notifyRoleAudience(options, roles = []) {
  const { db } = options;
  const selected = [...new Set(roles.filter(Boolean))].slice(0, 10);
  if (!db || !selected.length) return { stored: 0, push: 0, email: 0 };

  // Spotly authorization can live either on users.roles (platform/admin roles) or on the
  // canonical Staff profile role pack. Review alerts must reach both or a legitimate reviewer
  // can have queue access without ever receiving the corresponding notification.
  const [userSnapshot, staffSnapshot] = await Promise.all([
    db.collection("users").where("roles", "array-contains-any", selected).limit(100).get().catch(() => null),
    db.collection("staffProfiles").where("rolePackId", "in", selected).limit(100).get().catch(() => null)
  ]);
  const userIds = new Set();
  for (const doc of userSnapshot?.docs || []) {
    if (!["suspended", "disabled"].includes(String(doc.data().status || "active"))) userIds.add(doc.id);
  }
  for (const doc of staffSnapshot?.docs || []) {
    if (["active", "probation", "preboarding", "leave"].includes(String(doc.data().status || "active"))) userIds.add(doc.id);
  }
  return notifyUsers(options, [...userIds]);
}
