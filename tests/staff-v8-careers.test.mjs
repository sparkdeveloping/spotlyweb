import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Careers is a first-class Spotly product domain", () => {
  const domains = read("lib/spotly-domains.js");
  const proxy = read("proxy.js");
  assert.match(domains, /careers: "https:\/\/careers\.spotlyafrica\.com"/);
  assert.match(domains, /careers: "\/careers"/);
  assert.match(domains, /careers: new Set\(\["jobs", "apply", "application"\]\)/);
  assert.match(proxy, /"careers\.spotlyafrica\.com": "\/careers"/);
  assert.match(proxy, /careers: "careers\.spotlyafrica\.com"/);
});

test("Careers ships real public openings with role-shaped details", () => {
  const careers = read("data/careers.js");
  for (const role of [
    "Customer Support Associate",
    "Business Success Associate",
    "Business Verification Officer",
    "Driver Operations Coordinator",
    "Catalogue & Content Associate"
  ]) assert.match(careers, new RegExp(role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(careers, /responsibilities:/);
  assert.match(careers, /requirements:/);
  assert.match(careers, /rolePackId:/);
});

test("public applications are server-authoritative and trackable without account creation", () => {
  const api = read("app/api/careers/applications/route.js");
  const ui = read("components/careers-app.js");
  assert.match(api, /careerApplications/);
  assert.match(api, /careerApplicationRateLimits/);
  assert.match(api, /trackingTokenHash/);
  assert.match(api, /crypto\.randomBytes\(24\)/);
  assert.match(api, /career-applications\/\$\{applicationRef\.id\}\/cv/);
  assert.match(api, /5 \* 1024 \* 1024/);
  assert.match(ui, /No account required/);
  assert.match(ui, /Track this application/);
  assert.doesNotMatch(ui, /firebase\/firestore/);
});

test("career applicant records and CVs are browser inaccessible", () => {
  const firestore = read("firestore.rules");
  const storage = read("storage.rules");
  for (const collection of ["careerJobs", "careerApplications", "careerApplicationRateLimits"]) {
    const block = firestore.slice(firestore.indexOf(`match /${collection}/`));
    assert.match(block.slice(0, 180), /allow read, write: if false/);
  }
  const cvBlock = storage.slice(storage.indexOf("match /career-applications/"));
  assert.match(cvBlock.slice(0, 220), /allow read, write: if false/);
});

test("Staff Hiring operates the same Careers records through permission-protected APIs", () => {
  const api = read("app/api/staff/hiring/route.js");
  const ui = read("components/staff-hiring.js");
  assert.match(api, /requireSpotlyStaffPermission/);
  assert.match(api, /recruitment\.read/);
  assert.match(api, /recruitment\.manage/);
  assert.match(api, /careerApplications/);
  assert.match(api, /careerJobs/);
  assert.match(api, /schedule_interview/);
  assert.match(api, /candidate_stage/);
  assert.match(ui, /Careers → Hiring → Onboarding → Staff|Public recruiting and internal employment are connected/);
  assert.match(ui, /Hire & onboard/);
});

test("hired candidates hand directly into secure Staff onboarding", () => {
  const hiring = read("components/staff-hiring.js");
  const invites = read("components/staff-invitations.js");
  const staff = read("components/staff-app.js");
  assert.match(hiring, /<StaffInvitations data=\{data\} initialCandidate=\{inviteCandidate\}/);
  assert.match(invites, /initialCandidate = null/);
  assert.match(invites, /initialCandidate\?\.email/);
  assert.match(invites, /setOpen\(true\)/);
  assert.match(staff, /<StaffHiring data=\{data\} openModal=\{openModal\}/);
});

test("Staff V8 navigation uses human employee language and groups", () => {
  const staff = read("components/staff-app.js");
  assert.match(staff, /label: "Time off"/);
  assert.match(staff, /label: "Equipment"/);
  for (const group of ["Work", "People", "Me", "Support"]) assert.match(staff, new RegExp(`group: "${group}"`));
});

test("Careers routes are adaptive and private applicant routes are noindex", () => {
  const policy = read("config/theme-policy.json");
  const apply = read("app/careers/apply/[jobId]/page.js");
  const status = read("app/careers/application/[applicationId]/page.js");
  for (const route of ["/careers", "/careers/jobs/[jobId]", "/careers/apply/[jobId]", "/careers/application/[applicationId]"]) assert.match(policy, new RegExp(route.replace(/[\[\]/]/g, "\\$&")));
  assert.match(apply, /index: false/);
  assert.match(status, /index: false/);
  assert.match(status, /nocache: true/);
});

test("Staff lifecycle explicitly handles joining, active, leave and controlled exit states", () => {
  const staffData = read("data/staff.js");
  for (const state of ["preboarding", "probation", "active", "leave", "suspended", "offboarding", "former"]) {
    assert.match(staffData, new RegExp(`${state}: \\{`));
  }
  assert.match(staffData, /\["active", "probation", "preboarding", "leave"\]\.includes/);
  assert.match(staffData, /\["suspended", "offboarding", "former", "alumni"\]\.includes/);
});

test("manager Staff views are reporting-team scoped instead of silently becoming HR administration", () => {
  const staff = read("components/staff-app.js");
  assert.match(staff, /directReportIds = new Set\(data\.directory\.filter\(\(person\) => person\.managerId === data\.user\.uid\)/);
  assert.match(staff, /data\.peopleAdministrator \? data\.shifts : data\.manager \? data\.shifts\.filter/);
  assert.match(staff, /data\.peopleAdministrator \? data\.leave : data\.manager \? data\.leave\.filter/);
  assert.match(staff, /data\.peopleAdministrator \|\| directReportIds\.has\(item\.userId\)/);
  assert.match(staff, /data\.peopleAdministrator \? data\.performance : data\.manager \? data\.performance\.filter/);
});

test("Staff Today and My Work expose action hierarchy, SLA, next action and first-day readiness", () => {
  const staff = read("components/staff-app.js");
  assert.match(staff, /Starting at Spotly/);
  assert.match(staff, /firstDayChecklist/);
  assert.match(staff, /Personal work queue/);
  assert.match(staff, /due\/SLA/i);
  assert.match(staff, /Next action/);
  assert.match(staff, /taskUrgency/);
});

test("employees can clock only their own shift even when a manager can see team schedules", () => {
  const staff = read("components/staff-app.js");
  assert.match(staff, /const canClock = shift\.userId === user\?\.uid/);
  assert.match(staff, /Clock your own shift/);
});

test("guided onboarding collects employee setup and keeps approval server-authoritative", () => {
  const ui = read("components/staff-onboarding.js");
  const api = read("app/api/staff/invitations/route.js");
  for (const phrase of ["Your details", "Your work", "Policies", "First day", "Emergency contact"]) assert.match(ui, new RegExp(phrase));
  assert.match(api, /policyAcknowledgements/);
  assert.match(api, /emergencyContactRelationship/);
  assert.match(api, /onboardingChecklist/);
  assert.match(api, /status: "probation"/);
  assert.match(api, /managerAssigned: Boolean\(invitation\.managerId\)/);
});

test("Hiring supports audited candidate communications and role-aware onboarding handoff", () => {
  const hiring = read("components/staff-hiring.js");
  const api = read("app/api/staff/hiring/route.js");
  const invites = read("components/staff-invitations.js");
  assert.match(api, /candidate_message/);
  assert.match(api, /career_candidate_message/);
  assert.match(api, /communications/);
  assert.match(hiring, /Candidate communication/);
  assert.match(hiring, /Send email/);
  assert.match(hiring, /rolePackId:job\?\.rolePackId/);
  assert.match(invites, /initialCandidate\?\.rolePackId/);
});

test("Careers has production-grade no-role, filtered-empty, SEO and transparent tracking states", () => {
  const careers = read("components/careers-app.js");
  assert.match(careers, /No roles are open right now/);
  assert.match(careers, /No roles match these filters/);
  assert.match(careers, /application\/ld\+json/);
  assert.match(careers, /JobPosting/);
  assert.match(careers, /Hiring path/);
  assert.match(careers, /Keep this URL private/);
  assert.match(careers, /What to expect after you apply/);
});

test("Staff recruitment navigation is permission-gated rather than granted to every manager", () => {
  const staff = read("components/staff-app.js");
  const staffData = read("data/staff.js");
  assert.match(staff, /if \(data\.canRecruit\) items\.push\(\{ id: "hiring"/);
  assert.match(staffData, /export function canRecruitStaff/);
  assert.match(staffData, /recruitment\.read/);
  assert.match(staffData, /recruitment\.manage/);
});

test("People Operations employment authority is server-owned and browser role escalation is denied", () => {
  const api = read("app/api/staff/people/route.js");
  const staff = read("components/staff-app.js");
  const rules = read("firestore.rules");
  assert.match(api, /requireSpotlyStaffPermission/);
  assert.match(api, /people\.write/);
  assert.match(api, /permissions: pack\.permissions/);
  assert.match(api, /staff_profile\.authority_updated/);
  assert.match(staff, /authenticatedFetch\("\/api\/staff\/people"/);
  const block = rules.slice(rules.indexOf("match /staffProfiles/{userId}"), rules.indexOf("match /staffTasks/{taskId}"));
  assert.match(block, /allow create: if false/);
  assert.match(block, /allow delete: if false/);
  assert.doesNotMatch(block, /allow update: if peopleAdmin/);
  assert.match(block, /affectedKeys\(\)\.hasOnly/);
});

test("People Operations role packs and department choices stay internally consistent", () => {
  const staffData = read("data/staff.js");
  assert.match(staffData, /"Operations",/);
  assert.match(staffData, /department: "Operations"/);
});

test("Manager directory access is limited to recorded direct reports while People Operations keeps full access", () => {
  const staff = read("components/staff-app.js");
  const services = read("lib/staff-services.js");
  const rules = read("firestore.rules");
  assert.match(services, /\["managerId", "==", normalized\.managerId\]/);
  assert.match(staff, /managerId: peopleAdministrator \? undefined : user\.uid/);
  const block = rules.slice(rules.indexOf("match /staffProfiles/{userId}"), rules.indexOf("match /staffTasks/{taskId}"));
  assert.match(block, /peopleAdmin\(\) \|\| \(staffManager\(\) && resource\.data\.managerId == request\.auth\.uid\)/);
});

test("Manager workforce mutations are direct-report scoped and employees cannot create their own shifts", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /function managesStaff\(userId\)/);
  const shifts = rules.slice(rules.indexOf("match /staffShifts/{shiftId}"), rules.indexOf("match /staffLeaveRequests/{requestId}"));
  assert.match(shifts, /allow create: if managesStaff\(request\.resource\.data\.userId\)/);
  assert.doesNotMatch(shifts, /allow create: if [^\n]*staffMember\(\)[^\n]*request\.auth\.uid/);
  const performance = rules.slice(rules.indexOf("match /staffPerformance/{recordId}"), rules.indexOf("match /staffPayrollRecords/{recordId}"));
  assert.match(performance, /allow create: if managesStaff\(request\.resource\.data\.userId\)/);
  assert.match(performance, /allow update, delete: if managesStaff\(resource\.data\.userId\)/);
  const assets = rules.slice(rules.indexOf("match /staffAssets/{assetId}"), rules.indexOf("match /workforceRequests/{requestId}"));
  assert.match(assets, /allow create, update, delete: if peopleAdmin\(\)/);
});
