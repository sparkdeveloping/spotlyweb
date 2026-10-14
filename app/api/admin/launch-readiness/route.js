import { authenticateRequest, apiError, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { BUILD_INFO } from "@/lib/build-info";
import { getSecretBundle, secretVaultReady } from "@/lib/platform-secrets-server";

export const runtime = "nodejs";

function present(value) {
  return Boolean(String(value || "").trim());
}

function item(id, label, state, detail) {
  return { id, label, state, detail };
}

function liveMarketplaceBusiness(record = {}) {
  const status = String(record.status || "").trim().toLowerCase();
  const lifecycle = String(record.lifecycleStatus || "").trim().toLowerCase();
  return record.public === true && !record.canonicalBusinessId && status !== "archived" && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "admin.configuration");
    const { db } = getAdminServices();
    const snapshot = await db.collection("platformSettings").doc("global").get();
    const settings = snapshot.exists ? snapshot.data() : {};
    const integrations = settings.integrations || {};
    const legal = settings.legal || {};
    const support = settings.support || {};
    const mobility = settings.mobility || {};
    const send = mobility.send || {};
    const [paynowVault, resendVault, schedulerVault, monitoringVault] = await Promise.all([getSecretBundle("paynow"), getSecretBundle("resend"), getSecretBundle("scheduler"), getSecretBundle("monitoring")]);

    const paynowCredentials = (present(paynowVault.integrationId) && present(paynowVault.integrationKey)) || (present(paynowVault.integrationIdUsd) && present(paynowVault.integrationKeyUsd)) || (present(process.env.PAYNOW_INTEGRATION_ID) && present(process.env.PAYNOW_INTEGRATION_KEY)) || (present(process.env.PAYNOW_INTEGRATION_ID_USD) && present(process.env.PAYNOW_INTEGRATION_KEY_USD));
    const emailCredentials = (present(resendVault.apiKey) && present(resendVault.fromEmail)) || (present(process.env.RESEND_API_KEY) && present(process.env.RESEND_FROM_EMAIL));
    const pushCredentials = present(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
    const appCheckCredentials = present(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY);
    const appCheckEnforced = process.env.SPOTLY_ENFORCE_APP_CHECK === "true";
    const legalConfigured = present(legal.legalName) && present(legal.companyNumber) && present(legal.registeredAddress) && present(legal.privacyEmail) && present(legal.termsEmail);
    const refundConfigured = present(legal.refundPolicyUrl);
    const supportConfigured = present(support.hours) && (present(support.email) || present(support.phone) || present(support.whatsapp));
    const rulesVerified = present(process.env.SPOTLY_RULES_VERIFIED_AT) && present(process.env.SPOTLY_STORAGE_RULES_VERIFIED_AT);
    const monitoringConfigured = present(monitoringVault.sentryDsn) || present(monitoringVault.verifiedAt) || present(process.env.SENTRY_DSN) || present(process.env.NEXT_PUBLIC_SENTRY_DSN) || present(process.env.SPOTLY_MONITORING_VERIFIED_AT);
    const backupVerified = present(process.env.SPOTLY_BACKUP_VERIFIED_AT);
    const firebaseAdminConfigured = (present(process.env.FIREBASE_ADMIN_PROJECT_ID) && present(process.env.FIREBASE_ADMIN_CLIENT_EMAIL) && present(process.env.FIREBASE_ADMIN_PRIVATE_KEY)) || present(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const storageConfigured = present(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const productionOrigin = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
    const productionOriginReady = productionOrigin === "https://spotlyafrica.com";
    const marketplaceIndexable = process.env.NEXT_PUBLIC_MARKETPLACE_INDEXABLE === "true";
    const financeEncryptionConfigured = present(process.env.SPOTLY_FINANCE_ENCRYPTION_KEY) || secretVaultReady();
    const schedulerSecret = String(schedulerVault.secret || process.env.CRON_SECRET || "").trim();
    const cronSecretConfigured = schedulerSecret.length >= 24;
    const bootstrapAllowlistPresent = present(process.env.BOOTSTRAP_ADMIN_EMAILS);
    const ridesEnabled = mobility.ridesEnabled === true || settings.launch?.ridesEnabled === true;
    const rideCities = Array.isArray(mobility.enabledCities) ? mobility.enabledCities.filter(Boolean) : [];
    const sendEnabled = send.enabled === true || settings.launch?.sendEnabled === true;
    const sendCities = Array.isArray(send.enabledCities) ? send.enabledCities.filter(Boolean) : [];
    const mobilityNeedsCron = ridesEnabled || sendEnabled;
    const rideRolloutReady = !ridesEnabled || (rideCities.length > 0 && cronSecretConfigured);
    const sendRolloutReady = !sendEnabled || (sendCities.length > 0 && cronSecretConfigured);

    let marketplaceCheck;
    try {
      const marketplaceSnapshot = await db.collection("businesses").where("public", "==", true).limit(100).get();
      const liveCount = marketplaceSnapshot.docs.filter((doc) => liveMarketplaceBusiness(doc.data())).length;
      marketplaceCheck = item(
        "marketplace-directory",
        "Customer marketplace directory",
        liveCount > 0 ? "ready" : "needs_verification",
        liveCount > 0
          ? `${liveCount} live public business${liveCount === 1 ? "" : "es"} can be resolved by the production-safe marketplace query.`
          : "The marketplace query is healthy, but no live public businesses were found. Confirm publication state before advertising customer discovery."
      );
    } catch (error) {
      marketplaceCheck = item("marketplace-directory", "Customer marketplace directory", "blocked", `The public business directory could not be queried: ${error.message || "unknown error"}`);
    }

    const checks = [
      item("firebase-admin", "Firebase Admin runtime", firebaseAdminConfigured ? "ready" : "blocked", firebaseAdminConfigured ? "Server-side Firebase credentials are configured." : "Firebase Admin credentials are missing; authenticated server operations cannot run."),
      item("storage", "Firebase Storage", storageConfigured ? "ready" : "blocked", storageConfigured ? "The production Storage bucket is configured." : "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing."),
      item("production-origin", "Production origin", productionOriginReady ? "ready" : "blocked", productionOriginReady ? "Canonical customer origin is https://spotlyafrica.com." : `NEXT_PUBLIC_APP_URL must be https://spotlyafrica.com for production; current value is ${productionOrigin || "not configured"}.`),
      item("marketplace-indexing", "Marketplace indexing", marketplaceIndexable ? "ready" : "needs_verification", marketplaceIndexable ? "Public marketplace indexing is enabled." : "NEXT_PUBLIC_MARKETPLACE_INDEXABLE is not true. Keep this off for staging, but enable it for the public launch candidate."),
      item("finance-encryption", "Finance encryption key", financeEncryptionConfigured ? "ready" : "blocked", financeEncryptionConfigured ? "Server-side finance encryption is configured." : "SPOTLY_FINANCE_ENCRYPTION_KEY is missing; protected payout/finance fields must not launch without it."),
      item("dispatch-cron", "Ride & Send dispatch scheduler", !mobilityNeedsCron ? "not_configured" : cronSecretConfigured ? "ready" : "blocked", !mobilityNeedsCron ? "Ride and Send are not enabled, so the dispatcher is not currently launch-critical." : cronSecretConfigured ? "A sufficiently long CRON_SECRET is configured for dispatch maintenance." : "Ride or Send is enabled but CRON_SECRET is missing or too short."),
      item("ride-rollout", "Ride launch geography", rideRolloutReady ? (ridesEnabled ? "ready" : "not_configured") : "blocked", !ridesEnabled ? "Ride is disabled." : rideCities.length ? `${rideCities.length} Ride launch cit${rideCities.length === 1 ? "y is" : "ies are"} configured and dispatch authentication is ready.` : "Ride is enabled without an explicit launch city."),
      item("send-rollout", "Send launch geography", sendRolloutReady ? (sendEnabled ? "ready" : "not_configured") : "blocked", !sendEnabled ? "Send is disabled." : sendCities.length ? `${sendCities.length} Send launch cit${sendCities.length === 1 ? "y is" : "ies are"} configured and dispatch authentication is ready.` : "Send is enabled without an explicit launch city."),
      item("bootstrap-admin", "Administrator bootstrap lock-down", bootstrapAllowlistPresent ? "needs_verification" : "ready", bootstrapAllowlistPresent ? "BOOTSTRAP_ADMIN_EMAILS is still configured. Remove the bootstrap allowlist after the initial super administrator is established." : "No administrator bootstrap allowlist is present in the production environment."),
      item("firestore-rules", "Firestore & Storage security tests", rulesVerified ? "ready" : "needs_verification", rulesVerified ? "Verification markers are configured for this environment." : "Run the Firebase Emulator rules matrix, then set the verification timestamps for the deployed environment."),
      item("paynow", "Paynow", integrations.paynowEnabled && paynowCredentials ? "ready" : integrations.paynowEnabled ? "blocked" : "not_configured", integrations.paynowEnabled ? (paynowCredentials ? "Enabled with server credentials present." : "Enabled, but server credentials are incomplete.") : "Provider is disabled in platform settings."),
      item("email", "Transactional email", integrations.emailEnabled && emailCredentials ? "ready" : integrations.emailEnabled ? "blocked" : "not_configured", integrations.emailEnabled ? (emailCredentials ? "Enabled with Resend credentials present." : "Enabled, but Resend credentials are incomplete.") : "Email delivery is disabled."),
      item("push", "Push notifications", integrations.pushEnabled && pushCredentials ? "ready" : integrations.pushEnabled ? "blocked" : "not_configured", integrations.pushEnabled ? (pushCredentials ? "Enabled with a VAPID key present." : "Enabled, but the VAPID key is missing.") : "Push delivery is disabled."),
      item("app-check", "Firebase App Check", integrations.appCheckEnabled && appCheckCredentials && appCheckEnforced ? "ready" : integrations.appCheckEnabled ? "blocked" : "not_configured", integrations.appCheckEnabled ? (appCheckCredentials && appCheckEnforced ? "Enabled, a site key is present, and API enforcement is active." : "App Check is enabled in settings, but the site key or SPOTLY_ENFORCE_APP_CHECK enforcement flag is missing.") : "App Check is disabled in platform settings."),
      marketplaceCheck,
      item("legal", "Legal identity & contacts", legalConfigured ? "ready" : "not_configured", legalConfigured ? "Legal identity and primary privacy/terms contacts are configured." : "Legal name, company registration number, registered address, privacy contact, and terms contact must be configured."),
      item("refund-policy", "Refund & cancellation policy", refundConfigured ? "ready" : "not_configured", refundConfigured ? "A configured policy URL is present." : "No final refund/cancellation policy URL is configured."),
      item("support", "Support staffing/contact", supportConfigured ? "needs_verification" : "not_configured", supportConfigured ? "Contact details and hours exist; confirm the stated hours are actually staffed." : "Configure a working support channel and staffed hours."),
      item("monitoring", "Production monitoring", monitoringConfigured ? "needs_verification" : "not_configured", monitoringConfigured ? "A monitoring configuration marker is present; verify alerts in staging." : "No monitoring verification marker or supported error-reporting DSN is present."),
      item("backup", "Backup / restore verification", backupVerified ? "ready" : "needs_verification", backupVerified ? "A backup verification timestamp is configured." : "Run and document a restore test, then set SPOTLY_BACKUP_VERIFIED_AT."),
    ];

    const blocked = checks.filter((check) => check.state === "blocked").length;
    const ready = checks.filter((check) => check.state === "ready").length;
    return Response.json({
      ok: true,
      build: { version: BUILD_INFO.version, commit: BUILD_INFO.commit, environment: BUILD_INFO.environment },
      summary: { ready, total: checks.length, blocked },
      checks
    });
  } catch (error) {
    return apiError(error);
  }
}
