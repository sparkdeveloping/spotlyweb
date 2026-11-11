import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../firebase/functions/src/core/mobility-road-access.js", import.meta.url), "utf8");
const shimmed = source.replace("import { HttpsError } from 'firebase-functions/v2/https';", "class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }");
const { interpretDrivingRoute, verifiedMobilityRoute, routingConfigured, routingCredentialsConfigured } = await import("data:text/javascript;base64," + Buffer.from(shimmed).toString("base64"));
const a = { lat: -17.825, lng: 31.03 }, b = { lat: -17.83, lng: 31.05 };
const pair = (p) => [p.lng, p.lat];
const success = (start = a, end = b) => ({
  code: "Ok",
  waypoints: [{ location: pair(start), name: "Road" }, { location: pair(end), name: "Second Road" }],
  routes: [{ distance: 2400, duration: 410, geometry: { coordinates: [pair(start), [31.04,-17.827], pair(end)] } }]
});
const wrapped = (data) => ({ ok: true, status: 200, json: async () => data });
const settings = (fetcher) => ({ endpoint: "https://routing.example.com", fetcher });

test("route uses verified geometry and flags material access adjustment", () => {
  const near = { lat: a.lat + 0.0005, lng: a.lng };
  const route = interpretDrivingRoute(success(near,b),a,b);
  assert.ok(route);
  assert.equal(route.accessPoints.pickup.requiresConfirmation,true);
  assert.equal(route.accessPoints.destination.requiresConfirmation,false);
  assert.ok(route.path.length >= 2);
});
test("endpoint beyond maximum road access is rejected", () => {
  assert.equal(interpretDrivingRoute(success({lat:a.lat+0.005,lng:a.lng},b),a,b),null);
});
test("direct drivable route requests 350m endpoint radiuses",async () => {
  const calls=[];
  const route=await verifiedMobilityRoute(a,b,settings(async url=>{calls.push(url);return wrapped(success());}));
  assert.equal(calls.length,1);
  assert.ok(calls[0].includes("radiuses=350%3B350"));
  assert.equal(route.distanceKm,2.4);
});
test("NoRoute recovers through nearest connected road candidates",async () => {
  const nearA={lat:a.lat+0.0003,lng:a.lng},nearB={lat:b.lat+0.0002,lng:b.lng};
  let requests=0;
  const route=await verifiedMobilityRoute(a,b,settings(async url=>{
    if(url.includes("/nearest/"))return wrapped({code:"Ok",waypoints:[{location:url.includes("31.030000")?pair(nearA):pair(nearB)}]});
    requests++;
    return wrapped(requests===1?{code:"NoRoute",routes:[]}:success(nearA,nearB));
  }));
  assert.ok(route.path.length >= 2);
  assert.ok(route.accessPoints.pickup.distanceMeters>=30);
});
test("unreachable locations never generate fake route geometry",async()=>{
  await assert.rejects(verifiedMobilityRoute(a,b,settings(async url=>url.includes("/nearest/")
    ?wrapped({code:"Ok",waypoints:[{location:[32,-19]}]})
    :wrapped({code:"NoRoute",routes:[]}))),/No connected driving access/);
});
test("routing outage stays an explicit unavailability, not a no-road claim",async()=>{
  await assert.rejects(verifiedMobilityRoute(a,b,settings(async()=>{throw Error("offline");})),
    (error)=>error.code==="unavailable");
});
test("invalid route geometry cannot be priced or displayed",()=>{
  const invalid=success();
  invalid.routes[0].geometry.coordinates[0]=[500,91];
  assert.equal(interpretDrivingRoute(invalid,a,b),null);
});
test("routing configuration requires HTTPS with no URL-embedded secrets",()=>{
  assert.equal(routingConfigured("http://example.com"),false);
  assert.equal(routingConfigured("https://example.com/route?key=abc"),false);
  assert.equal(routingConfigured("https://example.com"),true);
});

const mapMapKey = "snk_" + "a".repeat(24);
const mapMapSettings = (fetcher, key = mapMapKey) => ({
  endpoint: "https://api.mapmap.ai", key, fetcher
});
test("MapMap keeps wide retry disabled and never uses OSRM radiuses", async () => {
  const calls = [];
  const result = await verifiedMobilityRoute(a, b, mapMapSettings(async (url, options) => {
    calls.push({ url: new URL(url), options });
    return wrapped(success());
  }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/route/v1/driving/31.030000,-17.825000;31.050000,-17.830000");
  assert.equal(calls[0].url.searchParams.get("snap_retry"), "false");
  assert.equal(calls[0].url.searchParams.has("radiuses"), false);
  assert.equal(calls[0].options.headers.Authorization, "Bearer " + mapMapKey);
  assert.equal(result.routeSource, undefined);
  assert.equal(result.source, "verified_road_route");
});
test("MapMap NoRoute does not call nonexistent nearest/v1", async () => {
  const calls = [];
  await assert.rejects(verifiedMobilityRoute(a, b, mapMapSettings(async (url) => {
    calls.push(url);
    return wrapped({code: "NoRoute", routes: []});
  })), (error) => error.code === "failed-precondition");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("/route/v1/driving/"));
});
test("MapMap 400 is a provider error, not a claim about road access", async () => {
  const calls = [];
  await assert.rejects(verifiedMobilityRoute(a, b, mapMapSettings(async (url) => {
    calls.push(url);
    return {ok: false, status: 400, json: async () => ({code: "InvalidQuery", message: "unsupported option"})};
  })), (error) => error.code === "unavailable" && /provider rejected/.test(error.message));
  assert.equal(calls.length, 1);
});
test("Firebase readiness requires MapMap's server-side routing key", () => {
  assert.equal(routingCredentialsConfigured("https://api.mapmap.ai", undefined), false);
  assert.equal(routingCredentialsConfigured("https://api.mapmap.ai", "fake-key"), false);
  assert.equal(routingCredentialsConfigured("https://api.mapmap.ai", mapMapKey), true);
  assert.equal(routingCredentialsConfigured("https://routing.example.com"), true);
  assert.equal(routingCredentialsConfigured("http://routing.example.com"), false);
});

test("MapMap HTTP 400 NoRoute is a geography failure rather than provider outage", async () => {
  for (const code of ["NoRoute", "NoSegment"]) {
    await assert.rejects(
      verifiedMobilityRoute(a, b, mapMapSettings(async () => ({
        ok: false, status: 400, json: async () => ({ code, routes: [] })
      }))),
      (error) => error.code === "failed-precondition" && /No connected drivable route/.test(error.message)
    );
  }
});

test("MapMap HTTP 400 InvalidQuery remains provider integration failure", async () => {
  await assert.rejects(
    verifiedMobilityRoute(a, b, mapMapSettings(async () => ({
      ok: false, status: 400, json: async () => ({ code: "InvalidQuery", message: "unknown option" })
    }))),
    (error) => error.code === "unavailable" && /provider rejected/.test(error.message)
  );
});

test("MapMap rejects roads farther than 350 metres despite valid geometry", async () => {
  const farStart = { lat: a.lat + 0.004, lng: a.lng };
  await assert.rejects(
    verifiedMobilityRoute(a, b, mapMapSettings(async () => wrapped(success(farStart, b)))),
    (error) => error.code === "failed-precondition" && /access is too far/.test(error.message)
  );
});

test("routing rejects coincident and almost coincident pickup and destination", async () => {
  await assert.rejects(
    verifiedMobilityRoute(a, {lat:a.lat+0.00005,lng:a.lng+0.00001}, mapMapSettings(async()=>wrapped(success()))),
    (error) => error.code === "invalid-argument"
  );
});
