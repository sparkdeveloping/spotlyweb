"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPhoneNumber,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  updateProfile
} from "firebase/auth";
import { getToken } from "firebase/messaging";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseClient, getFirebaseMessaging } from "@/lib/firebase";
import { clearUserSessionState } from "@/lib/browser-state";
import { portalForHostname, spotlyPortalUrl } from "@/lib/spotly-domains";
import {
  DEFAULT_PLATFORM_SETTINGS,
  ensureUserProfile,
  subscribeMemberships,
  subscribePlatformSettings,
  subscribeUserProfile,
  track
} from "@/lib/firebase-services";

const AuthContext = createContext(null);
const PlatformContext = createContext(null);

function friendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Use a stronger password with at least eight characters.",
    "auth/popup-closed-by-user": "The sign-in window was closed before completion.",
    "auth/provider-already-linked": "This sign-in method is already linked.",
    "auth/credential-already-in-use": "This sign-in method is linked to another Spotly account.",
    "auth/too-many-requests": "Too many attempts. Wait briefly and try again.",
    "auth/network-request-failed": "The network request failed. Check your connection and try again.",
    "auth/requires-recent-login": "For security, sign in again before making this change."
  };
  return messages[code] || error?.message || "Authentication could not be completed.";
}

async function persistSharedBrowserSession(firebaseUser) {
  if (!firebaseUser || firebaseUser.isAnonymous) return false;
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { Authorization: `Bearer ${idToken}` }
  });
  return response.ok;
}


async function sharedBrowserSessionState() {
  const response = await fetch("/api/auth/session", { method: "GET", credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok && payload.ok !== false, status: response.status, ...payload };
}

async function bootstrapSharedBrowserSession(auth) {
  const response = await fetch("/api/auth/session/bootstrap", { method: "POST", credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  if (!payload.customToken) return null;
  return (await signInWithCustomToken(auth, payload.customToken)).user;
}

async function clearSharedBrowserSession() {
  await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => null);
}

export function FirebaseProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [staffProfile, setStaffProfile] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [driverApplication, setDriverApplication] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const recaptchaRef = useRef(null);
  const sharedBootstrapAttemptedRef = useRef(false);
  const initialAuthResolvedRef = useRef(false);

  useEffect(() => {
    const client = getFirebaseClient();
    if (!client) {
      setAuthReady(true);
      return undefined;
    }
    return onAuthStateChanged(client.auth, async (nextUser) => {
      setAuthError("");
      const initialEvent = !initialAuthResolvedRef.current;
      initialAuthResolvedRef.current = true;

      if (initialEvent && nextUser && !nextUser.isAnonymous) {
        try {
          const shared = await sharedBrowserSessionState();
          if (shared.ok && shared.uid && shared.uid !== nextUser.uid) {
            const restoredUser = await bootstrapSharedBrowserSession(client.auth);
            if (restoredUser) return;
          }
          if (!shared.ok && ["signed_out", "expired"].includes(shared.reason)) {
            await signOut(client.auth);
            return;
          }
          if (!shared.ok && shared.reason === "missing") await persistSharedBrowserSession(nextUser).catch(() => false);
        } catch {
          // Existing Firebase sessions remain usable when the shared-session endpoint is temporarily unavailable.
        }
      }

      if (!nextUser && !sharedBootstrapAttemptedRef.current) {
        sharedBootstrapAttemptedRef.current = true;
        try {
          const restoredUser = await bootstrapSharedBrowserSession(client.auth);
          if (restoredUser) return; // signInWithCustomToken triggers this observer again with the restored user.
        } catch {
          // Shared SSO is a convenience layer. If it is unavailable, normal Firebase sign-in still works.
        }
      }

      setUser(nextUser);
      if (nextUser) {
        try {
          if (!nextUser.isAnonymous) await ensureUserProfile(nextUser);
          track("auth_session_started", { provider_count: nextUser.providerData.length, anonymous: nextUser.isAnonymous });
        } catch (error) {
          setAuthError(error.message);
        }
      } else {
        setProfile(null);
        setMemberships([]);
        setStaffProfile(null);
        setDriverProfile(null);
        setDriverApplication(null);
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return undefined;
    let reconciling = false;
    async function reconcileSharedSession() {
      if (reconciling || document.visibilityState === "hidden") return;
      reconciling = true;
      try {
        const shared = await sharedBrowserSessionState();
        const client = getFirebaseClient();
        if (!client?.auth.currentUser) return;
        if (shared.ok && shared.uid && shared.uid !== client.auth.currentUser.uid) {
          sharedBootstrapAttemptedRef.current = false;
          await signOut(client.auth);
          return;
        }
        if (!shared.ok && ["signed_out", "expired"].includes(shared.reason)) {
          sharedBootstrapAttemptedRef.current = true;
          await signOut(client.auth);
          return;
        }
        if (!shared.ok && shared.reason === "missing") await persistSharedBrowserSession(client.auth.currentUser).catch(() => false);
      } catch {
        // Do not destroy a valid local session because a session-health request temporarily failed.
      } finally {
        reconciling = false;
      }
    }
    const onVisibility = () => { if (document.visibilityState === "visible") reconcileSharedSession(); };
    const interval = window.setInterval(reconcileSharedSession, 5 * 60 * 1000);
    window.addEventListener("focus", reconcileSharedSession);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", reconcileSharedSession);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) {
      setProfile(null);
      return undefined;
    }
    return subscribeUserProfile(user.uid, setProfile, (error) => setAuthError(error.message));
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) {
      setMemberships([]);
      return undefined;
    }
    return subscribeMemberships(user.uid, setMemberships, (error) => setAuthError(error.message));
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) {
      setStaffProfile(null);
      setDriverProfile(null);
      setDriverApplication(null);
      return undefined;
    }
    const client = getFirebaseClient();
    if (!client) return undefined;
    const unsubStaff = onSnapshot(doc(client.db, "staffProfiles", user.uid), (snapshot) => setStaffProfile(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), () => setStaffProfile(null));
    const unsubDriver = onSnapshot(doc(client.db, "drivers", user.uid), (snapshot) => setDriverProfile(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), () => setDriverProfile(null));
    const unsubDriverApplication = onSnapshot(doc(client.db, "driverApplications", user.uid), (snapshot) => setDriverApplication(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), () => setDriverApplication(null));
    return () => { unsubStaff(); unsubDriver(); unsubDriverApplication(); };
  }, [user?.uid, user?.isAnonymous]);


  const ensureAnonymousSession = useCallback(async () => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase is not configured.");
    if (client.auth.currentUser) return client.auth.currentUser;
    try {
      const result = await signInAnonymously(client.auth);
      await track("anonymous_session_started", { purpose: "public_support" });
      return result.user;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);
  const createAccount = useCallback(async ({ email, password, displayName }) => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase is not configured.");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const activeUser = client.auth.currentUser;
      const result = activeUser?.isAnonymous
        ? await linkWithCredential(activeUser, EmailAuthProvider.credential(normalizedEmail, password))
        : await createUserWithEmailAndPassword(client.auth, normalizedEmail, password);
      if (displayName) await updateProfile(result.user, { displayName });
      await ensureUserProfile(result.user, { displayName });
      await persistSharedBrowserSession(result.user).catch(() => false);
      await sendEmailVerification(result.user, { url: spotlyPortalUrl("customer", "/account") }).catch(() => {});
      await track("sign_up", { method: "password" });
      return result.user;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase is not configured.");
    try {
      const result = await signInWithEmailAndPassword(client.auth, email.trim().toLowerCase(), password);
      await ensureUserProfile(result.user);
      await persistSharedBrowserSession(result.user).catch(() => false);
      await track("login", { method: "password" });
      return result.user;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const logout = useCallback(async () => {
    const client = getFirebaseClient();
    const activeUser = client?.auth?.currentUser || user;
    clearUserSessionState(activeUser);
    await clearSharedBrowserSession();
    if (client) await signOut(client.auth);
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase is not configured.");
    try {
      await sendPasswordResetEmail(client.auth, email.trim().toLowerCase(), { url: spotlyPortalUrl("customer", "/login") });
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const linkProvider = useCallback(async (providerId) => {
    const client = getFirebaseClient();
    if (!client?.auth.currentUser) throw new Error("Create or sign in to your email-and-password account first.");
    try {
      const provider = providerId === "google.com" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
      if (providerId === "apple.com") provider.addScope("email");
      const result = await linkWithPopup(client.auth.currentUser, provider);
      await ensureUserProfile(result.user);
      await track("auth_provider_linked", { provider: providerId });
      return result.user;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const addPassword = useCallback(async ({ email, password }) => {
    const client = getFirebaseClient();
    if (!client?.auth.currentUser) throw new Error("No active account.");
    try {
      const credential = EmailAuthProvider.credential(email.trim().toLowerCase(), password);
      const result = await linkWithCredential(client.auth.currentUser, credential);
      await ensureUserProfile(result.user);
      return result.user;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const beginPhoneLink = useCallback(async (phoneNumber, containerId = "spotly-recaptcha") => {
    const client = getFirebaseClient();
    if (!client?.auth.currentUser) throw new Error("Create or sign in to your email-and-password account first.");
    try {
      if (recaptchaRef.current) recaptchaRef.current.clear();
      recaptchaRef.current = new RecaptchaVerifier(client.auth, containerId, { size: "invisible" });
      return await linkWithPhoneNumber(client.auth.currentUser, phoneNumber, recaptchaRef.current);
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const enablePushNotifications = useCallback(async () => {
    const client = getFirebaseClient();
    if (!client || !client.auth.currentUser) throw new Error("Sign in first.");
    if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was not granted.");
    const messaging = await getFirebaseMessaging();
    if (!messaging) throw new Error("Messaging is not supported in this browser.");
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) throw new Error("Push notifications are not available yet.");
    const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
    await setDoc(doc(client.db, "pushTokens", token), {
      token,
      userId: client.auth.currentUser.uid,
      workspace: portalForHostname(window.location.hostname),
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      active: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
    return token;
  }, []);

  const hasRole = useCallback((role) => {
    if (profile?.roles?.includes("super_admin")) return true;
    if (profile?.roles?.includes(role)) return true;
    return memberships.some((membership) => membership.role === role || membership.permissions?.includes(role));
  }, [memberships, profile?.roles]);

  const authValue = useMemo(() => ({
    user,
    profile,
    memberships,
    staffProfile,
    driverProfile,
    driverApplication,
    authReady,
    authError,
    createAccount,
    signIn,
    logout,
    resetPassword,
    linkProvider,
    addPassword,
    beginPhoneLink,
    enablePushNotifications,
    ensureAnonymousSession,
    hasRole
  }), [user, profile, memberships, staffProfile, driverProfile, driverApplication, authReady, authError, createAccount, signIn, logout, resetPassword, linkProvider, addPassword, beginPhoneLink, enablePushNotifications, ensureAnonymousSession, hasRole]);

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

export function PlatformProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const client = getFirebaseClient();
    if (!client) {
      setSettingsReady(true);
      return undefined;
    }
    return subscribePlatformSettings((next) => {
      setSettings(next);
      setSettingsReady(true);
    }, () => setSettingsReady(true));
  }, []);

  const value = useMemo(() => ({ settings, settingsReady }), [settings, settingsReady]);
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside FirebaseProvider");
  return value;
}

export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error("usePlatform must be used inside PlatformProvider");
  return value;
}
