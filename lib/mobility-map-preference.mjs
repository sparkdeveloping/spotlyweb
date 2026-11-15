/** Browser-tab preference only. Never requests or preloads map tiles. */
const KEY = "spotly:mobility:map-mode:v1";
export const MAP_MODE_EVENT = "spotly:mobility:map-mode";
export function mobilityMapMode() {
  try {
    const value = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(KEY);
    return value === "map" || value === "low" ? value : "auto";
  } catch {return "auto";}
}
export function shouldShowMobilityMap({mode=mobilityMapMode(), connection, online=true}={}) {
  if (online === false) return false;
  if (mode === "low") return false;
  if (mode === "map") return true;
  return !(connection?.saveData === true || ["slow-2g","2g"].includes(connection?.effectiveType));
}
export function setMobilityMapMode(mode) {
  if (!["low", "map", "auto"].includes(mode)) return false;
  try { if (typeof sessionStorage === "undefined") return false;
    if (mode === "auto") sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, mode);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(MAP_MODE_EVENT));
    return true;
  } catch { return false; }
}
