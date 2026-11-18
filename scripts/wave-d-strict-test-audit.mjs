#!/usr/bin/env node
/** Fail-closed parser of the final Node TAP summary. Source tests are not a deployment test. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function evaluateStrictNodeRun(tap = "") {
  const number = label => {
    const matches = [...tap.matchAll(new RegExp(`^# ${label} (\\d+)\\s*$`, "gm"))];
    return matches.length === 1 ? Number(matches[0][1]) : null;
  };
  const tests = number("tests"), passed = number("pass"), failed = number("fail"), skipped = number("skipped"), todo = number("todo");
  const blockers = [];
  if ([tests, passed, failed, skipped, todo].some(value => value === null)) blockers.push("Complete TAP test-count summary missing or duplicated");
  else {
    if (tests < 1 || passed + failed + skipped + todo !== tests) blockers.push("TAP totals do not reconcile");
    if (failed > 0) blockers.push(`${failed} tests failed`);
    if (skipped > 0) blockers.push(`${skipped} tests skipped: Wave D requires documented resolution`);
    if (todo > 0) blockers.push(`${todo} tests remain TODO`);
  }
  return { status: blockers.length ? "BLOCKED" : "SOURCE_SUITE_PASSED_ONLY", productionDecision: "NO_GO", tests, passed, failed, skipped, todo, blockers };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  const result = file && existsSync(file) ? evaluateStrictNodeRun(readFileSync(file, "utf8")) : evaluateStrictNodeRun("");
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "SOURCE_SUITE_PASSED_ONLY") process.exitCode = 2;
}
