import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {driverPhoneUsable,requirementPlan} from "../lib/driver-capabilities.js";
import {safeDriverBlockers,driverBlockerStep,driverBlockerHelp} from "../lib/driver-application-feedback.js";
const code=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Submit blockers survive serialization and remain actionable on the Driver page",()=>{
 const checks=[
  {id:"identity",label:"Your details",ok:false},
  {id:"document_identity",label:"Identification",ok:false,status:"rejected"},
  {id:"payout",label:"Payout details saved",ok:false},
  {id:"training_general_safety",label:"Driver safety & privacy",ok:false},
  {id:"agreements",label:"Driver agreements accepted",ok:false},
  {id:"work",label:"Work types selected",ok:true}
 ];
 const blockers=safeDriverBlockers(checks);
 assert.equal(blockers.length,5);
 assert.deepEqual(blockers.map(b=>b.step),[0,2,4,5,5]);
 assert.ok(blockers.every(b=>b.ok===false));
 assert.deepEqual(safeDriverBlockers(JSON.parse(JSON.stringify(blockers))),blockers);
 assert.match(driverBlockerHelp(blockers[1]),/Replace the rejected document/);
 assert.equal(driverBlockerStep("vehicle"),1);
 assert.equal(driverBlockerStep("document_licence"),2);
});
test("Country prefix alone is not a usable Driver contact number",()=>{
 assert.equal(driverPhoneUsable("+263"),false);
 assert.equal(driverPhoneUsable(""),false);
 assert.equal(driverPhoneUsable("+263771234567"),true);
 assert.equal(driverPhoneUsable("0771234567"),true);
 const incomplete=requirementPlan({application:{
  legalName:"Example Driver",phone:"+263",city:"Harare",
  requestedCapabilities:[]},vehicle:null,documents:[]});
 assert.equal(incomplete.checks.find(x=>x.id==="identity").ok,false);
});
test("Submission API returns sanitized blockers to the existing API client",()=>{
 const server=code("app/api/driver/application/route.js");
 const client=code("lib/api-client.js");
 assert.ok(server.includes("blockers:safeDriverBlockers(readiness.checks)"));
 assert.ok(server.includes("status:409"));
 assert.ok(client.includes("error.blockers = payload.blockers"));
 assert.ok(!server.includes('Error("Complete every Driver application step before submitting."'));
});
test("Driver review displays exact missing items and stops if saving draft fails",()=>{
 const ui=code("components/driver-app.js");
 assert.ok(ui.includes("applicationIssues=submissionBlockers.length?submissionBlockers:pendingChecks"));
 assert.ok(ui.includes('aria-label="Application requirements to fix"'));
 assert.ok(ui.includes("setSubmissionBlockers(safeDriverBlockers(err.blockers"));
 assert.ok(ui.includes("if(!(await saveStep(5)))return;"));
 assert.ok(ui.includes("driverPhoneUsable(form.phone)"));
 assert.ok(ui.includes("Go to {DRIVER_APPLICATION_STEP_LABELS[item.step]}"));
 assert.ok(ui.includes('aria-label="Remaining application requirements"'));
});
test("No required documents or training/vehicle approvals bypassed",()=>{
 const server=code("app/api/driver/application/route.js");
 assert.ok(server.includes("applicationReadiness(appSnap.data(), primaryVehicle, documents)"));
 assert.ok(server.includes('status: "application_submitted"'));
 const capability=code("lib/driver-capabilities.js");
 for(const requirement of ["documentTypes.map","trainingModules.map","payoutComplete","agreementsAccepted && application.locationConsent"]){
  assert.ok(capability.includes(requirement),requirement);
 }
});
