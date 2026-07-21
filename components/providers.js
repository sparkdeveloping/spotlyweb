"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

const ThemeContext = createContext(null);
const ToastContext = createContext(null);

const themeListeners = new Set();

function getThemeSnapshot() {
  return window.localStorage.getItem("spotly-theme") || "system";
}

function getThemeServerSnapshot() {
  return "system";
}

function subscribeTheme(listener) {
  themeListeners.add(listener);
  const onStorage = (event) => {
    if (event.key === "spotly-theme") listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setStoredTheme(nextTheme) {
  window.localStorage.setItem("spotly-theme", nextTheme);
  themeListeners.forEach((listener) => listener());
}

function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.dataset.theme = theme;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme: setStoredTheme,
    isDark: theme === "dark"
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message, options = {}) => {
    const id = `${Date.now()}-${Math.random()}`;
    const next = { id, message, type: options.type || "success", title: options.title || "Done" };
    setToasts((items) => [...items.slice(-3), next]);
    window.setTimeout(() => dismiss(id), options.duration || 3600);
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
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
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
