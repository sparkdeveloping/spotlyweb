"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function ConnectivityBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] px-4 py-2 text-center text-sm font-semibold text-[var(--on-warning-soft)]">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You are offline. Some Spotly actions will resume when your connection returns.
    </div>
  );
}
