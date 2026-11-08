"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/firebase-provider";
import { countryDefinition, countryFromCoordinates, resolveCountryContext, SPOTLY_COUNTRIES } from "@/lib/country-engine";
import { saveCountryPreference, subscribeAccountCountryOverride } from "@/lib/firebase-services";

const CountryContext = createContext(null);
const GUEST_KEY = "spotly.country.code";

export function CountryProvider({ children }) {
  const { user, profile } = useAuth();
  const [override, setOverride] = useState(null);
  const [guestCode, setGuestCode] = useState(null);
  const [deviceSuggestion, setDeviceSuggestion] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setGuestCode(localStorage.getItem(GUEST_KEY)); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) { setOverride(null); return undefined; }
    return subscribeAccountCountryOverride(user.uid, setOverride, () => setOverride(null));
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    const explicit = profile?.preferences?.countryCode || guestCode;
    if (explicit || override?.countryCode || !navigator?.permissions || !navigator?.geolocation) return;
    let cancelled = false;
    navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (cancelled || permission.state !== "granted") return;
      navigator.geolocation.getCurrentPosition((position) => {
        if (cancelled) return;
        setDeviceSuggestion(countryFromCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }));
      }, () => {}, { maximumAge: 300000, timeout: 5000 });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.preferences?.countryCode, guestCode, override?.countryCode]);

  const resolved = useMemo(() => resolveCountryContext({
    overrideCountryCode: override?.countryCode,
    preferenceCountryCode: profile?.preferences?.countryCode || guestCode,
    suggestedCountryCode: deviceSuggestion
  }), [override?.countryCode, profile?.preferences?.countryCode, guestCode, deviceSuggestion]);

  const selectCountry = useCallback(async (countryCode, { preferredCity = "", source = "manual" } = {}) => {
    const country = countryDefinition(countryCode);
    if (!country) throw new Error("Choose a supported Spotly country.");
    if (override?.countryCode) throw new Error("This account's country is currently managed by Spotly operations.");
    if (user?.uid && !user.isAnonymous) {
      await saveCountryPreference(user.uid, { countryCode: country.code, countrySource: source, preferredCity });
    } else {
      try { localStorage.setItem(GUEST_KEY, country.code); } catch {}
      setGuestCode(country.code);
    }
    setDeviceSuggestion(null);
  }, [override?.countryCode, user?.uid, user?.isAnonymous]);

  const suggestFromCurrentLocation = useCallback(async () => {
    if (!navigator?.geolocation) return null;
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition((position) => {
      const code = countryFromCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      setDeviceSuggestion(code); resolve(code);
    }, () => resolve(null), { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }));
  }, []);

  const value = useMemo(() => ({
    countries: SPOTLY_COUNTRIES, ready, countryCode: resolved.countryCode,
    country: countryDefinition(resolved.countryCode), source: resolved.source,
    locked: resolved.locked, suggested: resolved.suggested === true,
    override, selectCountry, suggestFromCurrentLocation
  }), [ready, resolved, override, selectCountry, suggestFromCurrentLocation]);
  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const value = useContext(CountryContext);
  if (!value) throw new Error("useCountry must be used inside CountryProvider");
  return value;
}
