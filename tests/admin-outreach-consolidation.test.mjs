import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { adminSectionsForProfile, canAccessAdminSection, hasAdminAccess } from "../lib/admin-access.js";
import { FIELD_ARCHIVE_KEY, fieldArchiveMessageId, fieldArchiveProspectId, fieldArchiveStatus, safeHistoricalDate } from "../lib/outreach-history-policy.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>readFileSync(resolve(root,file),"utf8");
test("NXT field roles access only Home and Outreach under Admin, never privileged areas",()=>{
 for(const role of ["nxt_manager","nxt_supervisor","nxt_outreach","nxt_analyst"]){
  const profile={roles:[role]};assert.equal(hasAdminAccess(profile),true);
  assert.deepEqual([...adminSectionsForProfile(profile)].sort(),["home","outreach"]);
  for(const section of ["work","marketplace","mobility","money","growth","team","system"])assert.equal(canAccessAdminSection(profile,section),false);
 }
 const admin={roles:["admin"]};
 for(const section of ["home","outreach","money","system"])assert.equal(canAccessAdminSection(admin,section),true);
});
test("Old NXT destination redirects to Admin without replacing underlying secured data",()=>{
 assert.match(read("app/nxt/page.js"),/https:\/\/admin\.spotlyafrica\.com\/outreach/);
 assert.match(read("proxy.js"),/host === "nxt.spotlyafrica.com"/);
 assert.match(read("proxy.js"),/destination.search = ""/);
 assert.match(read("data/portals.js"),/id: "outreach"/);
 assert.match(read("lib/spotly-domains.js"),/"outreach"/);
 assert.match(read("components/admin-app.js"),/AdminOutreach/);
 assert.match(read("components/admin-legacy-sections.js"),/adminSectionsForProfile/);
});
test("Private import does not publish or register a business and keeps importer distinct from credited agent",()=>{
 const api=read("app/api/admin/outreach-history/route.js");
 assert.match(api,/INTERNAL_ADMINS/);assert.match(api,/authenticateRequest/);assert.match(api,/confirmPrivateImport/);
 assert.match(api,/outreachAttribution:historicalAttribution/);
 assert.match(api,/importedBy:actor\.uid/);
 assert.match(api,/assigneeUid:"",businessId:"",public:false,claimStatus:"unclaimed",verificationStatus:"unverified"/);
 assert.doesNotMatch(api,/tx\.update\(.*ownerIds|batch\.update\(/);
 assert.doesNotMatch(read("components/admin-outreach-import.js"),/mitchelle2105@gmail\.com/);
});
test("Historical identifiers are reproducible and explicit declines remain suppressed",()=>{
 assert.equal(FIELD_ARCHIVE_KEY,"spotly-field-outreach-2026-11-18");
 assert.equal(fieldArchiveProspectId("OUT-001"),"field-2026-out-001");
 assert.equal(fieldArchiveMessageId("OUT-001",0),"field-2026-out-001-0000");
 assert.equal(fieldArchiveStatus("Declined"),"do_not_contact");
 assert.equal(fieldArchiveStatus("Contact-source question"),"do_not_contact");
 assert.equal(fieldArchiveStatus("Human engagement"),"contacted");
 assert.equal(fieldArchiveStatus("No reply"),"attempted");
 assert.throws(()=>fieldArchiveProspectId("../invalid"));
 assert.equal(safeHistoricalDate("2026-11-18"),"2026-11-18");
 assert.equal(safeHistoricalDate("2026-02-30"),"");
});
