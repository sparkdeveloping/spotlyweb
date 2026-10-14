import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

test("Admin Work exposes a first-class live Support chat surface", () => {
  const admin = read("components/admin-app.js");
  const inbox = read("components/admin-work-inbox.js");
  assert.match(admin, /AdminSupportConsole/);
  assert.match(admin, /label:\"Support chat\"/);
  assert.match(admin, /searchParams\.get\(\"view\"\)/);
  assert.match(inbox, /view=support&conversation=/);
  assert.match(inbox, /Open chat/);
});

test("Support console is a real agent workspace rather than a ticket-only queue", () => {
  const console = read("components/admin-support-console.js");
  for (const token of [
    "subscribeSupportConversations",
    "subscribeSupportMessages",
    "sendSupportMessage",
    "uploadSupportAttachment",
    "Internal note",
    "Canned reply",
    "Assign to me",
    "Escalate",
    "Resolve",
    "Previous conversations",
    "Recent Spotly activity"
  ]) assert.match(console, new RegExp(token));
  assert.match(console, /waiting_for_user/);
  assert.match(console, /unreadForSupport/);
  assert.match(console, /application\/pdf/);
});

test("Support conversation server owns unread state, assignment authority, and staff-only notes", () => {
  const route = read("app/api/support/conversations/route.js");
  assert.match(route, /unreadForSupport: 1/);
  assert.match(route, /unreadForRequester: 0/);
  assert.match(route, /markRead/);
  assert.match(route, /Internal notes are restricted to Spotly support staff/);
  assert.match(route, /Only support managers can assign conversations to another agent/);
  assert.match(route, /support\.conversation\.updated/);
  assert.match(route, /Spotly Support replied/);
  assert.match(route, /\/support\?conversation=/);
});

test("Agent support context is server-authoritative and scoped to support access", () => {
  const route = read("app/api/admin/support/context/route.js");
  assert.match(route, /requirePlatformPermission\(user, \"support\.read\"/);
  for (const collection of ["users", "businesses", "orders", "rideTrips", "parcelJobs", "deliveryJobs", "businessClaims", "paymentIntents"]) {
    assert.match(route, new RegExp(`\\\"${collection}\\\"`));
  }
  assert.match(route, /recentActivity/);
  assert.match(route, /supportHistory/);
  assert.match(route, /agents/);
});

test("Customer support can reopen the exact conversation from an agent reply", () => {
  const app = read("components/support-app.js");
  assert.match(app, /searchParams\.get\(\"conversation\"\)/);
  assert.match(app, /updateSupportConversation\(conversationId, \{ markRead: true \}/);
  assert.match(app, /writeState\(\"spotly-support-conversation\", user, linked/);
});

test("Support messages remain browser-read-only and internal notes remain support-only", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/supportConversations\/\{conversationId\}/);
  assert.match(rules, /allow update: if false/);
  assert.match(rules, /resource\.data\.internal != true \|\| supportStaff\(\)/);
  const storage = read("storage.rules");
  assert.match(storage, /match \/support\/\{conversationId\}\/\{uid\}\/\{fileName\}/);
  assert.match(storage, /application\/pdf\|image\/jpeg\|image\/png\|text\/plain/);
});
