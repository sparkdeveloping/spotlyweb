const ANON_SESSION_KEY = "spotly-anonymous-session";
const SESSION_PREFIXES = [
  "spotly-marketplace-cart",
  "spotly-checkout-draft",
  "spotly-support-conversation",
  "spotly-marketplace-location",
  "spotly-business-claim-draft",
  "spotly-driver-training"
];

function hasWindow() {
  return typeof window !== "undefined";
}

export function anonymousSessionId() {
  if (!hasWindow()) return "server";
  let value = window.sessionStorage.getItem(ANON_SESSION_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(ANON_SESSION_KEY, value);
  }
  return value;
}

export function stateScope(user) {
  return user?.uid && !user.isAnonymous ? `user:${user.uid}` : `session:${anonymousSessionId()}`;
}

export function scopedStateKey(base, user) {
  return `${base}:${stateScope(user)}`;
}

export function readState(base, user, fallback = null, storage = "session") {
  if (!hasWindow()) return fallback;
  const target = storage === "local" ? window.localStorage : window.sessionStorage;
  try {
    const raw = target.getItem(scopedStateKey(base, user));
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeState(base, user, value, storage = "session") {
  if (!hasWindow()) return;
  const target = storage === "local" ? window.localStorage : window.sessionStorage;
  try {
    target.setItem(scopedStateKey(base, user), JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing or when full. The UI remains usable in memory.
  }
}

export function removeState(base, user, storage = "session") {
  if (!hasWindow()) return;
  const target = storage === "local" ? window.localStorage : window.sessionStorage;
  target.removeItem(scopedStateKey(base, user));
}

export function migrateLegacyState(base, user, storage = "session") {
  if (!hasWindow()) return null;
  const legacyTarget = window.localStorage;
  const scopedTarget = storage === "local" ? window.localStorage : window.sessionStorage;
  const legacy = legacyTarget.getItem(base);
  if (!legacy) return null;
  const key = scopedStateKey(base, user);
  if (!scopedTarget.getItem(key)) scopedTarget.setItem(key, legacy);
  legacyTarget.removeItem(base);
  try { return JSON.parse(legacy); } catch { return null; }
}

export function clearUserSessionState(user) {
  if (!hasWindow()) return;
  const scope = stateScope(user);
  for (const target of [window.sessionStorage, window.localStorage]) {
    for (let index = target.length - 1; index >= 0; index -= 1) {
      const key = target.key(index);
      if (!key) continue;
      if (key.endsWith(`:${scope}`) || SESSION_PREFIXES.some((prefix) => key === prefix)) target.removeItem(key);
    }
  }
}

export const BROWSER_STATE_POLICY = Object.freeze({
  localPreferences: ["spotly-theme", "spotly-sidebar-collapsed"],
  sessionScoped: SESSION_PREFIXES,
  accountScoped: ["user.preferences", "businessClaimDrafts", "staffTrainingAssignments", "supportConversations", "driverAssignments"]
});
