/**
 * Customer operational polling is deliberately different from history loading:
 * only an open, visible browser tab should request frequent live status.
 * This controller has no Firebase or React dependencies so visibility, overlap,
 * failures and shutdown can be tested without connecting to production.
 */
export const CUSTOMER_STATUS_INTERVALS = Object.freeze({
  rideActiveMs: 8_000,
  sendActiveMs: 10_000,
  idleMs: 60_000,
  rideDispatchRetryMs: 25_000,
  sendDispatchRetryMs: 45_000,
  maxBackoffMs: 60_000
});

export function customerStatusInterval(kind, active) {
  return active
    ? (kind === "ride" ? CUSTOMER_STATUS_INTERVALS.rideActiveMs : CUSTOMER_STATUS_INTERVALS.sendActiveMs)
    : CUSTOMER_STATUS_INTERVALS.idleMs;
}

/** A failure never clears the last known active trip or parcel. */
export function createVisibleCustomerPoller({ poll, interval, visibility, schedule, cancel }) {
  if (typeof poll !== "function" || typeof interval !== "function") throw new TypeError("poll and interval are required");
  let timer = null;
  let running = false;
  let stopped = true;
  let failures = 0;
  let needsForegroundRefresh = false;
  const visible = () => visibility.visibilityState !== "hidden";
  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };
  const enqueue = (ms) => {
    clear();
    if (!stopped && visible()) timer = schedule(() => { timer = null; void tick(); }, ms);
  };
  async function tick() {
    if (stopped || !visible()) return;
    if (running) { needsForegroundRefresh = true; return; }
    running = true;
    try {
      await poll();
      failures = 0;
    } catch {
      failures = Math.min(3, failures + 1);
    } finally {
      running = false;
      if (stopped || !visible()) return;
      if (needsForegroundRefresh) {
        needsForegroundRefresh = false;
        enqueue(0);
      } else {
        enqueue(Math.min(CUSTOMER_STATUS_INTERVALS.maxBackoffMs, interval() * (1 << failures)));
      }
    }
  }
  const onVisibilityChange = () => {
    clear();
    if (!visible() || stopped) return;
    // Reconcile promptly after returning from the background; do not overlap
    // a request still resolving from before the tab became hidden.
    void tick();
  };
  return {
    start() {
      if (!stopped) return;
      stopped = false;
      visibility.addEventListener("visibilitychange", onVisibilityChange);
      enqueue(interval()); // Initial account/history load runs independently.
    },
    stop() {
      stopped = true;
      needsForegroundRefresh = false;
      clear();
      visibility.removeEventListener("visibilitychange", onVisibilityChange);
    },
    refreshNow: tick
  };
}
