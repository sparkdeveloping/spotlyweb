import { HttpsError } from 'firebase-functions/v2/https';

// Routing and tariff must share one verified road geometry. A selected POI or
// GPS fix is an intent coordinate, not necessarily safe vehicle access.
const MAX_ACCESS_METERS = 350;
const CONFIRM_ACCESS_METERS = 35;
const MAX_ROUTE_POINTS = 110;
const ROUTE_TIMEOUT_MS = 7500;
const DRIVING_ROUTE_MAX_METERS = 1_500_000;
const METERS_PER_RADIAN = 6_371_000;
const validPoint = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
  Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;
const point = (pair) => ({ lat: Number(pair[1]), lng: Number(pair[0]) });
const coordinates = (p) => Number(p.lng).toFixed(6) + "," + Number(p.lat).toFixed(6);
const rad = (degrees) => degrees * Math.PI / 180;

export function metersBetween(a, b) {
  const dlat = rad(b.lat - a.lat), dlng = rad(b.lng - a.lng);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 2 * METERS_PER_RADIAN * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}
export function routingConfigured(endpoint = process.env.SPOTLY_ROUTING_URL) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
// A deployed callable is not necessarily ready to route. MapMap requires a
// full server key; Vercel's environment is not inherited by Firebase.
export function routingCredentialsConfigured(
  endpoint = process.env.SPOTLY_ROUTING_URL,
  key = process.env.SPOTLY_ROUTING_API_KEY
) {
  if (!routingConfigured(endpoint)) return false;
  return new URL(endpoint).hostname !== 'api.mapmap.ai' ||
    /^snk_[A-Za-z0-9_-]{16,180}$/.test(String(key || ''));
}

function endpointUrl(root, service, coordinateList) {
  const url = new URL(root);
  url.pathname = url.pathname.replace(/\/$/, '') + "/" + service + "/v1/driving/" + coordinateList;
  if (service === 'route') {
    url.searchParams.set('overview', 'simplified');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', 'false');
    if (url.hostname === 'api.mapmap.ai') {
      // MapMap rejects OSRM's radiuses option (HTTP 400) and performs its own
      // bounded wider snap retry. Validate actual returned access offsets below.
      url.searchParams.set('snap_retry', 'true');
    } else {
      // Native OSRM supports per-waypoint radiuses.
      url.searchParams.set('radiuses', String(MAX_ACCESS_METERS) + ";" + MAX_ACCESS_METERS);
    }
  } else {
    url.searchParams.set('number', '3');
  }
  return url;
}

async function fetchOSRM(url, { key, fetcher, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (url.hostname === 'api.mapmap.ai') {
    if (!/^snk_[A-Za-z0-9_-]{16,180}$/.test(String(key || ''))) {
      throw new HttpsError('failed-precondition', 'Road routing credentials are not configured.');
    }
    headers.Authorization = "Bearer " + key;
  }
  let response;
  try {
    response = await fetcher(url.toString(), { headers, signal: signal || AbortSignal.timeout(ROUTE_TIMEOUT_MS), redirect: 'error' });
  } catch {
    throw new HttpsError('unavailable', 'The routing service could not be reached.');
  }
  if (response.status === 429) throw new HttpsError('resource-exhausted', 'Routing is busy.');
  if (!response.ok && ![400, 404, 422].includes(response.status)) {
    throw new HttpsError('unavailable', 'Routing is temporarily unavailable.');
  }
  let body;
  try { body = await response.json(); }
  catch { throw new HttpsError('unavailable', 'The road routing provider returned unreadable data.'); }
  // Invalid options and missing endpoints are integration failures, not
  // evidence that the selected street or building has no nearby access.
  if (!response.ok) {
    throw new HttpsError('unavailable', 'The road routing provider rejected this request.');
  }
  return body;
}

function normalizedAccess(intent, waypoint, fallback) {
  const location = waypoint?.location;
  const routed = Array.isArray(location) && location.length >= 2 ? point(location) : fallback;
  if (!validPoint(routed)) return null;
  const offsetMeters = metersBetween(intent, routed);
  if (!Number.isFinite(offsetMeters) || offsetMeters > MAX_ACCESS_METERS) return null;
  return {
    lat: Number(routed.lat.toFixed(6)), lng: Number(routed.lng.toFixed(6)),
    distanceMeters: Math.round(offsetMeters),
    // This label is a hint, not a claim of safe/legal curbside pickup.
    roadName: String(waypoint?.name || '').trim().slice(0, 100) || null,
    requiresConfirmation: offsetMeters >= CONFIRM_ACCESS_METERS
  };
}

export function interpretDrivingRoute(body, from, to) {
  const route = body?.routes?.[0];
  const distance = Number(route?.distance), duration = Number(route?.duration);
  if (body?.code !== 'Ok' || !Number.isFinite(distance) || distance < 30 || distance > DRIVING_ROUTE_MAX_METERS ||
      !Number.isFinite(duration) || duration <= 0 || duration > 604_800) return null;
  const raw = route?.geometry?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 50_000) return null;
  const vertices = raw.map((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2 ? point(coordinate) : null);
  if (vertices.some((vertex) => !validPoint(vertex))) return null;
  const waypointPickup = body.waypoints?.[0], waypointDestination = body.waypoints?.[1];
  const pickup = normalizedAccess(from, waypointPickup, vertices[0]);
  const destination = normalizedAccess(to, waypointDestination, vertices.at(-1));
  if (!pickup || !destination) return null;
  // Prevent mixing a route for entirely different endpoints with this quote.
  if (metersBetween(vertices[0], pickup) > 125 || metersBetween(vertices.at(-1), destination) > 125) return null;
  const stride = Math.max(1, Math.ceil(vertices.length / MAX_ROUTE_POINTS));
  const path = vertices.filter((_, i) => i % stride === 0 || i === vertices.length - 1);
  return {
    distanceKm: Number((distance / 1000).toFixed(2)),
    durationMinutes: Math.max(1, Math.ceil(duration / 60)),
    source: 'verified_road_route', path,
    accessPoints: { pickup, destination }
  };
}

function nearestCandidates(body, intent) {
  if (body?.code !== 'Ok') return [];
  const used = new Set();
  return (Array.isArray(body.waypoints) ? body.waypoints : [])
    .flatMap((row) => {
      const coordinate = Array.isArray(row?.location) ? point(row.location) : null;
      if (!validPoint(coordinate)) return [];
      const meters = metersBetween(intent, coordinate);
      if (meters > MAX_ACCESS_METERS) return [];
      const hash = coordinates(coordinate);
      if (used.has(hash)) return [];
      used.add(hash);
      return [{ ...coordinate, meters }];
    }).sort((a, b) => a.meters - b.meters).slice(0, 2);
}

// Returns only a provider-verified drivable geometry. It never draws a fake
// straight line and never assumes an arbitrary park/building point is road.
export async function verifiedMobilityRoute(from, to, {
  endpoint = process.env.SPOTLY_ROUTING_URL,
  key = process.env.SPOTLY_ROUTING_API_KEY,
  fetcher = fetch
} = {}) {
  if (!validPoint(from) || !validPoint(to)) throw new HttpsError('invalid-argument', 'Choose valid pickup and destination coordinates.');
  if (!routingCredentialsConfigured(endpoint, key)) throw new HttpsError('failed-precondition', 'Verified road routing credentials are not configured.');
  const root = new URL(endpoint);
  const route = async (a, b) => {
    const body = await fetchOSRM(endpointUrl(root, 'route', coordinates(a) + ";" + coordinates(b)), { key, fetcher });
    return interpretDrivingRoute(body, from, to);
  };
  const initial = await route(from, to);
  if (initial) return initial;

  // MapMap supports snap_retry on /route/v1 and has no OSRM /nearest/v1
  // fallback. Never call a nonexistent endpoint and mislabel the result as an
  // inaccessible pickup point. Its returned geometry is still checked above.
  if (root.hostname === 'api.mapmap.ai') {
    throw new HttpsError('failed-precondition', 'No connected drivable route is available near these locations.');
  }

  // Most OSRM-compatible engines already snap /route endpoints. For no segment
  // or no route, request alternative nearby drivable nodes, bounded by 350m.
  // No combinatorial or repeated client retries; just a few server-side attempts.
  const [nearestFrom, nearestTo] = await Promise.all([
    fetchOSRM(endpointUrl(root, 'nearest', coordinates(from)), { key, fetcher }).catch(() => null),
    fetchOSRM(endpointUrl(root, 'nearest', coordinates(to)), { key, fetcher }).catch(() => null)
  ]);
  const pickupOptions = nearestCandidates(nearestFrom, from);
  const destinationOptions = nearestCandidates(nearestTo, to);
  if (!pickupOptions.length || !destinationOptions.length) {
    throw new HttpsError('failed-precondition', 'No connected driving access is close enough to both locations.');
  }
  let best = null;
  for (const a of pickupOptions) {
    for (const b of destinationOptions) {
      try {
        const candidate = await route(a, b);
        if (!candidate) continue;
        const offset = a.meters + b.meters;
        if (!best || offset < best.offset) best = { route: candidate, offset };
      } catch (error) {
        if (error?.code === 'unavailable' || error?.code === 'resource-exhausted') throw error;
      }
    }
  }
  if (!best) throw new HttpsError('failed-precondition', 'No connected drivable route is available near these points.');
  return best.route;
}