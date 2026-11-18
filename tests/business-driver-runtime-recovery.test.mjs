import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const backend = read('../firebase/functions/src/core/driver-runtime.js');
const driver = read('../../../driver/spotlydriver/spotlydriver/Core/Services/DriverAppState.swift');
const driverHome = read('../../../driver/spotlydriver/spotlydriver/Features/Home/DriverHomeView.swift');
const driverShell = read('../../../driver/spotlydriver/spotlydriver/ContentView.swift');
const business = read('../../../business/spotlybusiness/spotlybusiness/App/BusinessAppState.swift');
const businessHub = read('../../../business/spotlybusiness/spotlybusiness/Features/Account/BusinessAccountHubView.swift');
const businessClient = read('../../../business/spotlybusiness/spotlybusiness/Production/FirebaseFunctionsService.swift');
const businessCallable = read('../../../business/spotlybusiness/Backend/functions/index.js');
const portfolioHandler = read('../../../business/spotlybusiness/Backend/functions/canonical/app/api/business/portfolio/route.js');

test('Driver bootstrap projects authoritative account readiness in addition to territory', () => {
  assert.match(backend, /const accountReadiness = \{/);
  assert.match(backend, /driverStatus: text\(driver\.status \|\| "unknown"/);
  assert.match(backend, /eligible: runtimeEligibility\.eligible/);
  assert.match(backend, /safetyHold: driver\.safetyHold === true/);
  assert.match(backend, /complianceHold: driver\.complianceHold === true/);
  assert.match(backend, /return \{ profile: profile\(actor, application, driver, selectedVehicle\), accountReadiness, dispatchReadiness/);
  assert.match(driver, /DriverAccountReadiness\.read\(data\["accountReadiness"\]/);
});

test('Driver dispatch does not grant offline approval when a backend field is absent', () => {
  assert.match(driver, /!accountReadiness\.hasVerifiedAccountStatus \{ return \.reconnect \}/);
  assert.match(driver, /DriverDispatchReadiness\.unavailable\.reason \{ return \.reconnect \}/);
  assert.match(driver, /DriverRuntimeServicePolicy\.mayGoOnline/);
  assert.match(backend, /if \(!territory\.verified\) return \{ eligible: false/);
  assert.match(backend, /ACTIVE_DRIVER_STATES\.has\(driver\.status\)/);
});

test('Driver makes account, area, and stale-backend recovery distinct', () => {
  assert.match(driver, /Couldn't check Driver readiness/);
  assert.match(driver, /Driver approval status unavailable/);
  assert.match(driverHome, /dispatchNextStep == \.reconnect/);
  assert.match(driver, /Review account/);
  assert.match(driver, /Review work area/);
  assert.match(driver, /homeNavPath\.append\(DriverRoute\.deliveryZones\)/);
  assert.doesNotMatch(driverShell, /Open Verification/);
  assert.match(driverShell, /appState\.reviewReadinessIssue\(\)/);
  assert.match(driverHome, /appState\.connection != \.ready && appState\.activeJob != nil/);
});

test('Business service exports a named authenticated, App Check-enabled portfolio callable', () => {
  assert.match(businessCallable, /export const businessPortfolio = callable\(operation0\)/);
  assert.match(businessCallable, /region: "us-central1", enforceAppCheck: true/);
  assert.match(portfolioHandler, /getBusinessPortfolio\(db, user\)/);
  assert.match(portfolioHandler, /Response\.json\(\{ ok: true, \.\.\.portfolio \}/);
  assert.match(businessClient, /Functions\.functions\(region: "us-central1"\)/);
  assert.match(businessClient, /SB-PORTFOLIO-404/);
});

test('A successful portfolio response survives selected-workspace failures', () => {
  assert.match(business, /portfolioBusinesses = response\.businesses/);
  assert.match(business, /catch \{\s*workspaceOpenError = \(error as\? AppError\)/);
  assert.match(business, /accountHubPresented = true\s*selectedPortfolioBusiness = nil\s*lifecycle = nil/);
  assert.match(business, /portfolioLoadError = nil/);
  assert.match(business, /portfolioLoadError = \(error as\? AppError\)/);
});

test('Business displays a single portfolio failure and does not label it an empty account', () => {
  assert.match(businessHub, /recoveryCard\(title: "Businesses couldn't load", error: error\)/);
  assert.match(businessHub, /if appState\.portfolioLoadError == nil/);
  assert.match(businessHub, /Your business starts here/);
  assert.doesNotMatch(businessHub, /Your business status needs attention/);
  assert.match(businessHub, /Resume an application/);
  assert.match(businessHub, /Get help/);
});
