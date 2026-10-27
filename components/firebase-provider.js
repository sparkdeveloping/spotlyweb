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
import { sharedSessionDecision } from "@/lib/auth-session-policy";
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

const SHARED_SESSION_RETRY_DELAYS = [0, 180, 450];

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function sharedBrowserSessionState() {
  const response = await fetch("/api/auth/session", { method: "GET", credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok && payload.ok !== false, status: response.status, ...payload };
}

async function persistSharedBrowserSession(firebaseUser, { required = false } = {}) {
  if (!firebaseUser || firebaseUser.isAnonymous) return false;
  let lastError = null;

  for (let attempt = 0; attempt < SHARED_SESSION_RETRY_DELAYS.length; attempt += 1) {
    const delay = SHARED_SESSION_RETRY_DELAYS[attempt];
    if (delay) await wait(delay);
    try {
      const idToken = await firebaseUser.getIdToken(attempt > 0);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        lastError = new Error(payload.error || "Spotly could not create the shared sign-in session.");
        continue;
      }
      const shared = await sharedBrowserSessionState();
      if (shared.ok && shared.uid === firebaseUser.uid) return true;
      lastError = new Error("Spotly could not verify the shared sign-in session.");
    } catch (error) {
      lastError = error;
    }
  }

  if (required) {
    throw new Error(lastError?.message || "Spotly signed you in here but could not finish cross-workspace sign-in. Try again.");
  }
  return false;
}

async function bootstrapSharedBrowserSession(auth) {
  const response = await fetch("/api/auth/session/bootstrap", { method: "POST", credentials: "include", cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  if (!payload.customToken) return null;
  return (await signInWithCustomToken(auth, payload.customToken)).user;
}

async function clearSharedBrowserSession() {
  await fetch("/api/auth/session", { method: "DELETE", credentials: "include", cache: "no-store" }).catch(() => null);
}

export function FirebaseProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [staffProfile, setStaffProfile] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [driverApplication, setDriverApplication] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [verificationRevision, setVerificationRevision] = useState(0);
  const recaptchaRef = useRef(null);
  const sharedBootstrapAttemptedRef = useRef(false);
  const initialAuthResolvedRef = useRef(false);
  const interactiveAuthRef = useRef(false);
  const authEventRef = useRef(0);
  const sessionEstablishedAtRef = useRef(0);

  useEffect(() => {
    const client = getFirebaseClient();
    if (!client) {
      setAuthReady(true);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(client.auth, async (nextUser) => {
      const event = ++authEventRef.current;
      setAuthError("");
      const initialEvent = !initialAuthResolvedRef.current;
      initialAuthResolvedRef.current = true;

      if (initialEvent && nextUser && !nextUser.isAnonymous) {
        if (interactiveAuthRef.current) {
          sharedBootstrapAttemptedRef.current = true;
        } else {
          try {
            const shared = await sharedBrowserSessionState();
            if (event !== authEventRef.current) return;
            const action = sharedSessionDecision({ localUid: nextUser.uid, shared });
            if (action === "switch") {
              const restored = await bootstrapSharedBrowserSession(client.auth);
              if (restored) { setSessionReady(true); return; }
            }
            if (action === "signout") {
              // The signed_out tombstone is created by an explicit sign-out on another tab.
              await signOut(client.auth);
              return;
            }
            if (action === "ready") setSessionReady(true);
            if (action === "renew") {
              const ready = await persistSharedBrowserSession(nextUser).catch(() => false);
              if (event !== authEventRef.current) return;
              setSessionReady(ready);
              if (ready) sessionEstablishedAtRef.current = Date.now();
            }
          } catch {
            // A shared-session outage is not evidence that the local Firebase account is invalid.
          }
        }
      }

      if (!nextUser && !sharedBootstrapAttemptedRef.current && !interactiveAuthRef.current) {
        sharedBootstrapAttemptedRef.current = true;
        try {
          const restored = await bootstrapSharedBrowserSession(client.auth);
          if (restored) { setSessionReady(true); return; }
        } catch {
          // Normal Firebase sign-in remains available when cross-domain bootstrap fails.
        }
      }
      if (event !== authEventRef.current) return;
      if (nextUser && !nextUser.isAnonymous) {
        try {
          await ensureUserProfile(nextUser);
          if (event !== authEventRef.current) return;
          track("auth_session_started", { provider_count: nextUser.providerData.length, anonymous: false });
        } catch (error) {
          if (event !== authEventRef.current) return;
          setAuthError(error.message);
        }
      } else if (nextUser?.isAnonymous) {
        setSessionReady(false);
      }
      if (event !== authEventRef.current) return;
      setUser(nextUser);
      if (!nextUser) {
        setSessionReady(false);
        setProfile(null);
        setMemberships([]);
        setStaffProfile(null);
        setDriverProfile(null);
        setDriverApplication(null);
      }
      // An interactive sign-in owns the final readiness transition after its
      // session-cookie write, so screens never briefly show a logged-out state.
      if (!interactiveAuthRef.current) setAuthReady(true);
    });
    return () => {
      authEventRef.current += 1;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return undefined;
    let reconciling = false;
    async function reconcileSharedSession() {
      if (reconciling || interactiveAuthRef.current || document.visibilityState === "hidden" ||
          Date.now() - sessionEstablishedAtRef.current < 8000) return;
      reconciling = true;
      try {
        const shared = await sharedBrowserSessionState();
        const current = getFirebaseClient()?.auth?.currentUser;
        if (!current || current.isAnonymous || interactiveAuthRef.current) return;
        const action = sharedSessionDecision({ localUid: current.uid, shared,
          interactive: interactiveAuthRef.current, recentlyEstablished: Date.now() - sessionEstablishedAtRef.current < 8000 });
        if (action === "switch") {
          // Swap identities atomically: do not briefly render an anonymous workspace.
          const restored = await bootstrapSharedBrowserSession(getFirebaseClient().auth);
          if (restored) setSessionReady(true);
          return;
        }
        if (action === "signout") {
          // Honor explicit global sign-out, but not a missing or expired session cookie.
          sharedBootstrapAttemptedRef.current = true;
          setSessionReady(false);
          await signOut(getFirebaseClient().auth);
          return;
        }
        if (action === "renew") {
          const ready = await persistSharedBrowserSession(current).catch(() => false);
          setSessionReady(ready);
          if (ready) sessionEstablishedAtRef.current = Date.now();
          return;
        }
        if (action === "ready") setSessionReady(true);
      } catch {
        // Network failures must not sign the user out or discard active forms.
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
    interactiveAuthRef.current = true;
    setSessionReady(false);
    setAuthReady(false);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const activeUser = client.auth.currentUser;
      const result = activeUser?.isAnonymous
        ? await linkWithCredential(activeUser, EmailAuthProvider.credential(normalizedEmail, password))
        : await createUserWithEmailAndPassword(client.auth, normalizedEmail, password);
      if (displayName) await updateProfile(result.user, { displayName });
      await ensureUserProfile(result.user, { displayName });
      // Creating the account must not claim email delivery succeeded when Firebase declined it.
      // Send before cross-domain SSO: a temporary session issue must not prevent the link.
      let verificationEmailSent = false;
      try {
        await sendEmailVerification(result.user, { url: spotlyPortalUrl("customer", "/account") });
        verificationEmailSent = true;
      } catch {
        // Signup remains valid. The in-app verification banner offers a real resend action.
      }
      await persistSharedBrowserSession(result.user, { required: true });
      sessionEstablishedAtRef.current = Date.now();
      setSessionReady(true);
      setUser(result.user);
      await track("sign_up", { method: "password" });
      return { user: result.user, verificationEmailSent };
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    } finally {
      interactiveAuthRef.current = false;
      setAuthReady(true);
    }
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase is not configured.");
    interactiveAuthRef.current = true;
    setSessionReady(false);
    setAuthReady(false);
    try {
      const result = await signInWithEmailAndPassword(client.auth, email.trim().toLowerCase(), password);
      await ensureUserProfile(result.user);
      await persistSharedBrowserSession(result.user, { required: true });
      sessionEstablishedAtRef.current = Date.now();
      setSessionReady(true);
      setUser(result.user);
      await track("login", { method: "password" });
      return result.user;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    } finally {
      interactiveAuthRef.current = false;
      setAuthReady(true);
    }
  }, []);

  const ensureSharedSession = useCallback(async () => {
    const current = getFirebaseClient()?.auth?.currentUser;
    if (!current || current.isAnonymous) throw new Error("Sign in to continue.");
    interactiveAuthRef.current = true;
    try {
      await persistSharedBrowserSession(current, { required: true });
      sessionEstablishedAtRef.current = Date.now();
      setSessionReady(true);
      return true;
    } catch (error) {
      setSessionReady(false);
      throw new Error(friendlyAuthError(error));
    } finally {
      interactiveAuthRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    interactiveAuthRef.current = true;
    setSessionReady(false);
    try {
      const client = getFirebaseClient();
      const activeUser = client?.auth?.currentUser || user;
      clearUserSessionState(activeUser);
      await clearSharedBrowserSession();
      if (client) await signOut(client.auth);
      setUser(null);
    } finally {
      interactiveAuthRef.current = false;
      setAuthReady(true);
    }
  }, [user]);

  const sendVerificationEmail = useCallback(async () => {
    const current = getFirebaseClient()?.auth?.currentUser;
    if (!current || current.isAnonymous || !current.email) {
      throw new Error("Sign in with an email address to request verification.");
    }
    try {
      await current.reload();
      setVerificationRevision((previous) => previous + 1);
      if (current.emailVerified) return { alreadyVerified: true };
      await sendEmailVerification(current, { url: spotlyPortalUrl("customer", "/account") });
      return { alreadyVerified: false };
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const refreshEmailVerification = useCallback(async () => {
    const current = getFirebaseClient()?.auth?.currentUser;
    if (!current || current.isAnonymous) throw new Error("Sign in to check your email verification.");
    try {
      await current.reload();
      // The Ride Lab and other protected API routes read the refreshed email_verified token claim.
      await current.getIdToken(true);
      setVerificationRevision((previous) => previous + 1);
      return current.emailVerified === true;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  useEffect(() => {
    if (!user?.uid || !user?.email || user.isAnonymous || user.emailVerified) return undefined;
    let lastRefresh = 0;
    function refreshOnReturn() {
      if (document.visibilityState !== "visible" || !getFirebaseClient()?.auth?.currentUser) return;
      const now = Date.now();
      if (now - lastRefresh < 30000) return;
      lastRefresh = now;
      refreshEmailVerification().catch(() => {
        // Manual verification status refresh remains available in the banner.
      });
    }
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [user?.uid, user?.email, user?.isAnonymous, user?.emailVerified, refreshEmailVerification]);

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
    sessionReady,
    authError,
    createAccount,
    signIn,
    logout,
    ensureSharedSession,
    sendVerificationEmail,
    refreshEmailVerification,
    resetPassword,
    linkProvider,
    addPassword,
    beginPhoneLink,
    enablePushNotifications,
    ensureAnonymousSession,
    hasRole
  }), [user, profile, memberships, staffProfile, driverProfile, driverApplication, authReady, sessionReady, authError, verificationRevision, createAccount, signIn, logout, ensureSharedSession, sendVerificationEmail, refreshEmailVerification, resetPassword, linkProvider, addPassword, beginPhoneLink, enablePushNotifications, ensureAnonymousSession, hasRole]);

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
