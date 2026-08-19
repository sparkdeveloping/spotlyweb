"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { FirebaseProvider, PlatformProvider } from "@/components/firebase-provider";

const ThemeContext = createContext(null);
const ToastContext = createContext(null);

const themeListeners = new Set();
const THEME_KEY = "spotly-theme";
const THEME_COOKIE = "spotly_theme";
const VALID_THEMES = new Set(["light", "dark", "system"]);

function normalizeTheme(value) {
  return VALID_THEMES.has(value) ? value : "system";
}

function readThemeCookie() {
  const match = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${THEME_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(THEME_COOKIE.length + 1)) : "";
}

function writeThemeCookie(value) {
  const production = window.location.hostname === "spotlyafrica.com" || window.location.hostname === "www.spotlyafrica.com" || window.location.hostname.endsWith(".spotlyafrica.com");
  const parts = [`${THEME_COOKIE}=${encodeURIComponent(value)}`, "Path=/", "Max-Age=31536000", "SameSite=Lax"];
  if (production) parts.push("Secure", "Domain=.spotlyafrica.com");
  document.cookie = parts.join("; ");
}

function getThemeSnapshot() {
  const shared = normalizeTheme(readThemeCookie());
  const local = normalizeTheme(window.localStorage.getItem(THEME_KEY));
  return readThemeCookie() ? shared : local;
}

function getThemeServerSnapshot() {
  return "system";
}

function subscribeTheme(listener) {
  themeListeners.add(listener);
  const onStorage = (event) => {
    if (event.key === THEME_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setStoredTheme(nextTheme) {
  const normalized = normalizeTheme(nextTheme);
  window.localStorage.setItem(THEME_KEY, normalized);
  writeThemeCookie(normalized);
  themeListeners.forEach((listener) => listener());
}

function resolveTheme(theme, mediaMatches) {
  return theme === "system" ? (mediaMatches ? "dark" : "light") : theme;
}

function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    const syncSharedTheme = () => {
      const shared = readThemeCookie();
      if (!shared) {
        writeThemeCookie(normalizeTheme(window.localStorage.getItem(THEME_KEY)));
        return;
      }
      const normalized = normalizeTheme(shared);
      if (window.localStorage.getItem(THEME_KEY) !== normalized) {
        window.localStorage.setItem(THEME_KEY, normalized);
        themeListeners.forEach((listener) => listener());
      }
    };
    update();
    syncSharedTheme();
    media.addEventListener("change", update);
    window.addEventListener("focus", syncSharedTheme);
    document.addEventListener("visibilitychange", syncSharedTheme);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("focus", syncSharedTheme);
      document.removeEventListener("visibilitychange", syncSharedTheme);
    };
  }, []);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    const dark = resolvedTheme === "dark";
    root.classList.toggle("dark", dark);
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, theme]);

  const value = useMemo(() => ({
    theme,
    selectedTheme: theme,
    resolvedTheme,
    setTheme: setStoredTheme,
    isDark: resolvedTheme === "dark"
  }), [resolvedTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message, options = {}) => {
    const normalized = typeof options === "string" ? { type: options } : options;
    const id = `${Date.now()}-${Math.random()}`;
    const next = { id, message, type: normalized.type || "success", title: normalized.title || "Done" };
    setToasts((items) => [...items.slice(-3), next]);
    window.setTimeout(() => dismiss(id), normalized.duration || 3600);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-[390px]">
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const Icon = item.type === "error" ? CircleAlert : item.type === "info" ? Info : CheckCircle2;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.97 }}
                className="surface pointer-events-auto flex w-full items-start gap-3 rounded-2xl p-4 shadow-elevated"
              >
                <Icon className={item.type === "error" ? "mt-0.5 h-5 w-5 text-danger" : item.type === "info" ? "mt-0.5 h-5 w-5 text-info" : "mt-0.5 h-5 w-5 text-success"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-secondary">{item.message}</p>
                </div>
                <button aria-label="Dismiss notification" className="rounded-lg p-1 text-tertiary hover:bg-[var(--surface-2)]" onClick={() => dismiss(item.id)}>
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function AppProviders({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <FirebaseProvider>
          <PlatformProvider>
            <ToastProvider>{children}</ToastProvider>
          </PlatformProvider>
        </FirebaseProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside AppProviders");
  return value;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside AppProviders");
  return value;
}
