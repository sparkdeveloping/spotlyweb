import "server-only";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";
import { loadOperationGrants } from "@/lib/operations-grants-server";

// Apply only to new customer commercial transactions. Existing orders, cancellations,
// support, personal data access and account deletion must remain available in maintenance.
export async function requireCustomerLaunchAccess(user, db) {
  const global = await db.collection("platformSettings").doc("global").get();
  const launch = { ...DEFAULT_PLATFORM_SETTINGS.launch, ...(global.data()?.launch || {}) };
  if (launch.publicMode === "maintenance") {
    throw Object.assign(new Error("Spotly is temporarily under maintenance. New requests are paused."), { status: 503 });
  }
  if (["first_access", "coming-soon", "private-beta"].includes(launch.publicMode)) {
    if (user?.uid) {
      const grants = await loadOperationGrants(db, user.uid);
      if (grants.some((grant) => ["service_preview", "service_operations"].includes(grant.type))) return true;
    }
    throw Object.assign(new Error("This service is currently available only to accounts with an active Spotly Operations preview grant."), { status: 403 });
  }
  return true;
}
