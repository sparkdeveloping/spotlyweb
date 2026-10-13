"use client";

import { AuthGate } from "@/components/auth-gate";
import { CustomerShell } from "@/components/customer-shell";
import { NotificationCenter } from "@/components/notification-center";
import { useAuth } from "@/components/firebase-provider";

export function CustomerNotificationsPage({ customerMode = true }) {
  const { user, profile } = useAuth();
  const locationLabel = profile?.preferences?.preferredCity || "Harare";
  return <AuthGate>
    <CustomerShell current="profile" user={user} profile={profile} locationLabel={locationLabel}>
      <div className="mx-auto max-w-4xl"><NotificationCenter workspace="customer" customerMode={customerMode} /></div>
    </CustomerShell>
  </AuthGate>;
}
