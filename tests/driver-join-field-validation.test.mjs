import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDriverLeadContact, publicDriverLeadFieldErrors } from "../lib/driver-lead-form-validation.js";

const valid = { legalName: "Sample Driver", country: "MW", city: "Lilongwe", phone: "0991234567", email: "" };
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Driver signup accepts a valid country-specific phone without email", () => {
  assert.deepEqual(validateDriverLeadContact(valid), {});
  assert.deepEqual(validateDriverLeadContact({ ...valid, phone: "", email: "driver@example.com" }), {});
});

test("Driver signup flags invalid contact values before leaving step one", () => {
  const errors = validateDriverLeadContact({ ...valid, phone: "123", email: "not-an-email" });
  assert.match(errors.phone, /valid phone number/);
  assert.match(errors.email, /valid email address/);
  assert.ok(validateDriverLeadContact({ ...valid, country: "MW", city: "Harare" }).city);
  assert.ok(validateDriverLeadContact({ ...valid, phone: "", email: "" }).phone);
  assert.ok(validateDriverLeadContact({ ...valid, legalName: "A" }).legalName);
});

test("Public validation responses expose known field names, not internals", () => {
  const errors = publicDriverLeadFieldErrors([
    { path: ["lead", "email"], code: "invalid_format" },
    { path: ["phone"], code: "too_big" },
    { path: ["sessionId"], code: "too_small" },
    { path: ["lead", "unexpectedInternalField"], code: "invalid_type" },
  ]);
  assert.deepEqual(Object.keys(errors), ["email", "phone"]);
  assert.match(errors.email, /valid email address/);
});

test("Driver signup returns field errors and revisits step one for contact failures", async () => {
  const [api, ui] = await Promise.all([
    read("app/api/public/driver-leads/route.js"),
    read("components/driver/driver-acquisition-landing.js"),
  ]);
  assert.match(api, /fieldErrors: contactErrors/);
  assert.match(api, /publicDriverLeadFieldErrors\(error\.issues\)/);
  assert.match(ui, /setStep\(1\)/);
  assert.match(ui, /setFieldErrors\(issues\)/);
  assert.match(ui, /scrollIntoView/);
  assert.match(ui, /aria-invalid=\{Boolean\(fieldErrors\.email\)\}/);
});
