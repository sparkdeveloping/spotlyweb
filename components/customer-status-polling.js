"use client";

import { useEffect, useRef } from "react";
import { createVisibleCustomerPoller } from "@/lib/customer-status-polling.mjs";

/** Keep the latest callback without tearing down the timer on every render. */
export function useVisibleCustomerStatusPolling({ enabled, ownerKey, intervalMs, poll }) {
  const pollRef = useRef(poll);
  useEffect(() => { pollRef.current = poll; }, [poll]);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = createVisibleCustomerPoller({
      poll: () => pollRef.current(),
      interval: () => intervalMs,
      visibility: document,
      schedule: (fn, delay) => window.setTimeout(fn, delay),
      cancel: (timer) => window.clearTimeout(timer)
    });
    controller.start();
    return () => controller.stop();
  }, [enabled, ownerKey, intervalMs]);
}
