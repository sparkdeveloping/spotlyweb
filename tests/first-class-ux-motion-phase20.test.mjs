import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const ios=(path)=>readFileSync(new URL(`../../../ios/spotly/spotly/${path}`,import.meta.url),"utf8");
const driver=(path)=>readFileSync(new URL(`../../../driver/spotlydriver/spotlydriver/${path}`,import.meta.url),"utf8");

test("Phase 20 web interaction primitives meet touch targets and honor Reduce Motion",()=>{
  const ui=read("components/ui.js");
  assert.match(ui,/useReducedMotion/);
  assert.match(ui,/sm: "h-11/);
  assert.match(ui,/md: "h-\[52px\]/);
  assert.match(ui,/min-h-\[52px\]/);
  assert.match(ui,/aria-busy=\{loading \|\| undefined\}/);
  assert.match(ui,/transition=\{reduceMotion \? \{ duration: 0 \}/);
});

test("Phase 20 web chrome respects reduced transparency, contrast, and mobile safe areas",()=>{
  const css=read("app/globals.css");
  const shell=read("components/customer-shell.js");
  assert.match(css,/@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css,/@media \(prefers-contrast: more\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(shell,/useReducedMotion/);
  assert.match(shell,/min-h-\[68px\]/);
});

test("Phase 20 web mobility tracking uses vehicle glyphs instead of text badges",()=>{
  const map=read("components/mobility-map.js");
  assert.match(map,/role","img"/);
  assert.match(map,/Driver \$\{label\} location/);
  assert.match(map,/<svg aria-hidden=/);
  assert.doesNotMatch(map,/el\.textContent=label/);
});

test("Phase 20 customer iOS typography and motion are accessibility driven",()=>{
  const typography=ios("Core/Theme/SpotlyTypography.swift");
  const motion=ios("Core/Theme/SpotlyMotion.swift");
  const root=ios("Core/Navigation/RootView.swift");
  assert.match(typography,/\.system\(\.largeTitle/);
  assert.match(typography,/\.system\(\.body/);
  assert.doesNotMatch(typography,/\.system\(size:/);
  assert.match(motion,/accessibilityReduceMotion/);
  assert.match(motion,/transaction\.disablesAnimations = true/);
  assert.match(root,/spotlyRespectsReducedMotion\(\)/);
});

test("Phase 20 customer transaction screens anchor primary actions and protect focus",()=>{
  const ride=ios("Features/Production/RideRequestView.swift");
  const send=ios("Features/Production/SendRequestView.swift");
  const checkout=ios("Features/Production/MarketplaceCheckoutView.swift");
  for(const source of [ride,send]) {
    assert.match(source,/safeAreaInset\(edge: \.bottom\)/);
    assert.match(source,/SpotlyBottomActionBar/);
    assert.match(source,/scrollDismissesKeyboard\(\.interactively\)/);
  }
  assert.match(checkout,/toolbar\(\.hidden, for: \.tabBar\)/);
  assert.match(checkout,/scrollDismissesKeyboard\(\.interactively\)/);
});

test("Phase 20 customer glass controls and saved controls remain legible with Reduce Transparency",()=>{
  const production=ios("Features/Production/ProductionComponents.swift");
  const buttons=ios("Core/Components/SpotlyButton.swift");
  assert.match(production,/accessibilityReduceTransparency/);
  assert.match(production,/SpotlyBottomActionBar/);
  assert.match(production,/frame\(width: 44, height: 44\)/);
  assert.match(buttons,/accessibilityReduceTransparency/);
});

test("Phase 20 customer mobility history uses the approved vehicle class for live markers",()=>{
  const activity=ios("Features/Production/ActivityView.swift");
  const tracking=ios("Features/Production/OperationalTrackingViews.swift");
  assert.match(activity,/SpotlyVehicleMapMarker\(type: delivery\.driver\?\.vehicle\?\.type\)/);
  assert.match(tracking,/case "motorcycle"/);
  assert.match(tracking,/case "van"/);
  assert.match(tracking,/accessibilityLabel\("Driver vehicle location/);
});

test("Phase 20 Driver typography and root motion honor system accessibility settings",()=>{
  const typography=driver("Core/Theme/SpotlyDriverTypography.swift");
  const motion=driver("Core/Theme/SpotlyDriverMotion.swift");
  const root=driver("ContentView.swift");
  assert.match(typography,/\.system\(\.largeTitle/);
  assert.match(typography,/\.system\(\.body/);
  assert.doesNotMatch(typography,/\.system\(size:/);
  assert.match(motion,/accessibilityReduceMotion/);
  assert.match(root,/driverRespectsReducedMotion\(\)/);
});

test("Phase 20 Driver active work shows a real route map and launch-to-Maps action",()=>{
  const jobs=driver("Features/Jobs/JobDetailView.swift");
  const active=driver("Features/ActiveJob/ActiveJobView.swift");
  assert.match(jobs,/struct DriverRouteMapCard/);
  assert.match(jobs,/Map\(initialPosition: \.region\(mapRegion\)/);
  assert.match(jobs,/Marker\("Pickup"/);
  assert.match(jobs,/Marker\("Drop-off"/);
  assert.match(jobs,/Button\("Open in Maps"\)/);
  assert.match(active,/DriverRouteMapCard\(job: job\)/);
  assert.doesNotMatch(jobs,/DriverRouteMapPlaceholder/);
});

test("Phase 20 Driver controls expand with Dynamic Type instead of clipping text",()=>{
  const button=driver("Core/Components/DriverButton.swift");
  const field=driver("Core/Components/DriverTextField.swift");
  const home=driver("Features/Home/DriverHomeView.swift");
  assert.doesNotMatch(button,/maxHeight: max\(44, height\)/);
  assert.match(button,/fixedSize\(horizontal: false, vertical: true\)/);
  assert.match(field,/frame\(minHeight: 50\)/);
  assert.match(home,/dynamicTypeSize\.isAccessibilitySize/);
});
