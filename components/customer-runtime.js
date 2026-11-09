"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useCountry } from "@/components/country-provider";
import { authenticatedFetch } from "@/lib/api-client";
import { resolveCustomerRuntime } from "@/lib/customer-runtime";

export function useCustomerRuntime({ country = "", city = "" } = {}) {
  const { user, authReady } = useAuth();
  const { settings, settingsReady } = usePlatform();
  const countryContext = useCountry();
  const [grantState, setGrantState] = useState({ loading: true, grants: [] });

  useEffect(() => {
    let active = true;
    if (!authReady) return () => { active = false; };
    if (!user?.uid || user.isAnonymous) {
      setGrantState({ loading: false, grants: [] });
      return () => { active = false; };
    }
    setGrantState((current) => ({ ...current, loading: true }));
    authenticatedFetch("/api/account/operations-grants", { cache: "no-store" })
      .then((result) => { if (active) setGrantState({ loading: false, grants: result.grants || [] }); })
      .catch(() => { if (active) setGrantState({ loading: false, grants: [] }); });
    return () => { active = false; };
  }, [authReady, user?.uid, user?.isAnonymous]);

  const countryCode = country || countryContext.countryCode || "";
  const runtime = useMemo(() => resolveCustomerRuntime(settings, {
    country: countryCode,
    city,
    grants: grantState.grants
  }), [settings, countryCode, city, grantState.grants]);

  return {
    ...runtime,
    grants: grantState.grants,
    grantsLoading: grantState.loading,
    ready: Boolean(settingsReady && countryContext.ready && authReady && !grantState.loading),
    settingsReady,
    countryReady: countryContext.ready,
    authReady
  };
}
