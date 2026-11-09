"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/components/firebase-provider";

const EMPTY = Object.freeze({ servicePreview: false, serviceOperations: false, paymentSandbox: false, locationOverride: false, driverOperations: false });

export function useOperationsContext({ service = "", country = "", city = "" } = {}) {
  const { user, authReady } = useAuth();
  const [state, setState] = useState({ loading: true, context: EMPTY, grants: [] });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    return params.toString();
  }, [service, country, city]);
  useEffect(() => {
    let active = true;
    if (!authReady) return () => { active = false; };
    if (!user?.uid || user.isAnonymous) { setState({ loading: false, context: EMPTY, grants: [] }); return () => { active = false; }; }
    setState((current) => ({ ...current, loading: true }));
    authenticatedFetch(`/api/account/operations-grants${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then((result) => { if (active) setState({ loading: false, context: { ...EMPTY, ...(result.context || {}) }, grants: result.grants || [] }); })
      .catch(() => { if (active) setState({ loading: false, context: EMPTY, grants: [] }); });
    return () => { active = false; };
  }, [authReady, user?.uid, user?.isAnonymous, query]);
  return state;
}
