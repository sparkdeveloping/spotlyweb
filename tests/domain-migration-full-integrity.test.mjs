import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  activePortalNavigationId,
  canonicalSpotlyUrl,
  isLocalPortalSection,
  normalizePortalPath,
  portalForHostname,
  portalSectionFromPath,
  resolveSpotlyHref,
  spotlyPortalUrl
} from "../lib/spotly-domains.js";
import { businessSectionFromPath, isBusinessKioskLivePath, businessHref } from "../lib/business-routing.js";

const proxy = fs.readFileSync(new URL("../proxy.js", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/portal-shell.js", import.meta.url), "utf8");
const businessLayout = fs.readFileSync(new URL("../components/business/business-layout-client.js", import.meta.url), "utf8");
const businessContext = fs.readFileSync(new URL("../components/business/business-context.js", import.meta.url), "utf8");
const notifications = fs.readFileSync(new URL("../lib/notification-server.js", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../components/firebase-provider.js", import.meta.url), "utf8");

test("clean product paths drive sidebar state after hostname rewrites", () => {
  assert.equal(normalizePortalPath("business", "/staff"), "/staff");
  assert.equal(businessSectionFromPath("/staff"), "staff");
  assert.equal(portalSectionFromPath("admin", "/drivers", "dashboard"), "drivers");
  assert.equal(activePortalNavigationId("business", [{ id: "portfolio", href: "/" }, { id: "staff", href: "/staff" }], "/staff", "portfolio"), "staff");
  assert.match(shell, /resolvedActiveSection/);
  assert.match(shell, /activePortalNavigationId/);
});

test("Business staff is a local Business section and not a cross-product Staff redirect", () => {
  assert.match(proxy, /PRODUCT_LOCAL_SECTIONS/);
  assert.match(proxy, /!localSection\(host, pathname\)/);
  assert.match(proxy, /PORTAL_LOCAL_SECTIONS/);
  assert.equal(isLocalPortalSection("business", "/staff"), true);
  assert.equal(portalForHostname("business.spotlyafrica.com"), "business");
});

test("Business kiosk live mode recognizes clean subdomain URLs", () => {
  assert.equal(isBusinessKioskLivePath("/kiosk/live"), true);
  assert.equal(isBusinessKioskLivePath("/business/kiosk/live"), true);
  assert.match(businessLayout, /isBusinessKioskLivePath/);
  assert.doesNotMatch(businessLayout, /pathname\.startsWith\("\/business\/kiosk\/live"\)/);
});

test("Business route generation now emits canonical clean subdomain paths", () => {
  assert.equal(businessHref("/business/staff", { businessId: "abc" }), "/staff?business=abc");
  assert.equal(businessHref("/business", {}), "/");
  assert.doesNotMatch(businessContext, /pathname\.startsWith\("\/business\/"\)/);
});

test("product login and robots behavior are hostname-aware", () => {
  assert.match(proxy, /pathname === "\/login"/);
  assert.match(proxy, /searchParams\.set\("portal", currentPortal\)/);
  assert.match(proxy, /workspace-robots\.txt/);
  assert.equal(spotlyPortalUrl("admin", "/login"), "https://admin.spotlyafrica.com/login");
});

test("notifications and push registrations preserve workspace origin", () => {
  assert.match(notifications, /canonicalSpotlyUrl/);
  assert.match(notifications, /item\.workspace === notification\.workspace/);
  assert.match(provider, /workspace: portalForHostname\(window\.location\.hostname\)/);
  assert.match(provider, /origin: window\.location\.origin/);
});


test("portal root navigation stays on the current product domain", () => {
  assert.equal(resolveSpotlyHref("/", { currentPortal: "business" }), "/");
  assert.equal(resolveSpotlyHref("/", { currentPortal: "driver" }), "/");
  assert.equal(activePortalNavigationId("driver", [{ id: "home", href: "/" }, { id: "jobs", href: "/jobs" }], "/", ""), "home");
});

test("Business Team and Support remain local despite names that can be global or product-like", () => {
  assert.equal(isLocalPortalSection("business", "/staff"), true);
  assert.equal(resolveSpotlyHref("/staff", { currentPortal: "business" }), "/staff");
  assert.equal(resolveSpotlyHref("/support", { currentPortal: "business" }), "/support");
  assert.equal(resolveSpotlyHref("/support", { currentPortal: "driver" }), "/support");
  assert.equal(resolveSpotlyHref("/account", { currentPortal: "business" }), "https://spotlyafrica.com/account");
});

test("portal URL helpers remove legacy prefixes instead of creating redirect hops", () => {
  assert.equal(spotlyPortalUrl("business", "/business/settings?tab=profile"), "https://business.spotlyafrica.com/settings?tab=profile");
  assert.equal(spotlyPortalUrl("driver", "/driver/active"), "https://driver.spotlyafrica.com/active");
  assert.equal(canonicalSpotlyUrl("https://spotlyafrica.com/business/staff?business=abc", "customer"), "https://business.spotlyafrica.com/staff?business=abc");
  assert.equal(canonicalSpotlyUrl("https://business.spotlyafrica.com/business/catalog", "business"), "https://business.spotlyafrica.com/catalog");
  assert.equal(canonicalSpotlyUrl("https://business.spotlyafrica.com/account", "business"), "https://spotlyafrica.com/account");
});

test("cross-workspace notifications use the notification workspace rather than the current portal", () => {
  const center = fs.readFileSync(new URL("../components/notification-center.js", import.meta.url), "utf8");
  assert.match(shell, /canonicalSpotlyUrl\(item\.href, targetWorkspace\)/);
  assert.match(center, /canonicalSpotlyUrl\(item\.href, notificationWorkspace\(item\)\)/);
});

test("delivery notifications separate Driver and customer destinations", () => {
  const businessDelivery = fs.readFileSync(new URL("../app/api/business/delivery/route.js", import.meta.url), "utf8");
  const adminDelivery = fs.readFileSync(new URL("../app/api/admin/deliveries/route.js", import.meta.url), "utf8");
  assert.match(businessDelivery, /workspace:\s*"driver"/);
  assert.match(businessDelivery, /workspace:\s*"customer"/);
  assert.match(adminDelivery, /workspace:\s*"driver"/);
  assert.match(adminDelivery, /workspace:\s*"customer"/);
});

test("dedicated workspace domains are private crawler surfaces and have product manifests", () => {
  const manifest = fs.readFileSync(new URL("../app/manifest.js", import.meta.url), "utf8");
  for (const route of ["business", "admin", "driver", "staff"]) {
    const layout = fs.readFileSync(new URL(`../app/${route}/layout.js`, import.meta.url), "utf8");
    assert.match(layout, /index:\s*false/);
    assert.match(layout, /follow:\s*false/);
  }
  assert.match(manifest, /portalForHostname/);
  assert.match(manifest, /start_url:\s*"\/"/);
  assert.match(proxy, /workspace-robots\.txt/);
});


test("auth gates preserve the exact clean portal route through sign-in", () => {
  const authGate = fs.readFileSync(new URL("../components/auth-gate.js", import.meta.url), "utf8");
  assert.match(authGate, /usePathname/);
  assert.match(authGate, /useSearchParams/);
  assert.match(authGate, /normalizePortalPath/);
  assert.match(authGate, /next=\$\{encodeURIComponent\(next\)\}/);
});


test("theme preference follows the user across sibling product domains", () => {
  const providers = fs.readFileSync(new URL("../components/providers.js", import.meta.url), "utf8");
  assert.match(providers, /THEME_COOKIE = "spotly_theme"/);
  assert.match(providers, /Domain=\.spotlyafrica\.com/);
  assert.match(providers, /writeThemeCookie/);
  assert.match(providers, /window\.addEventListener\("focus", syncSharedTheme\)/);
});


test("payment callbacks remain on the customer apex after the workspace-domain split", () => {
  const serverHelpers = fs.readFileSync(new URL("../lib/server-helpers.js", import.meta.url), "utf8");
  const paynow = fs.readFileSync(new URL("../app/api/payments/paynow/initiate/route.js", import.meta.url), "utf8");
  assert.match(serverHelpers, /return "https:\/\/spotlyafrica\.com"/);
  assert.match(paynow, /const baseUrl = appUrl\(request\)/);
  assert.match(paynow, /paynow\.returnUrl = `\$\{baseUrl\}\/payment\/return/);
});
