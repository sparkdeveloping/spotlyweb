import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTestSummary, assessTestEvidence } from '../scripts/rb1-suite-gate.mjs';
const tap = (tests, pass, fail, skipped) => [
  `# tests ${tests}`, `# pass ${pass}`, `# fail ${fail}`, `# skipped ${skipped}`
].join('\n');

test('RB1 blocks a successful process with skipped integration checks', () => {
  const result = assessTestEvidence({ output: tap(985, 983, 0, 2), exitCode: 0 });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.productionDecision, 'NO_GO');
  assert.match(result.reasons.join(' '), /skipped/);
});
test('RB1 blocks failed tests even if the process exited zero', () => {
  assert.equal(assessTestEvidence({ output: tap(3, 2, 1, 0), exitCode: 0 }).status, 'BLOCKED');
});
test('RB1 rejects ambiguous or missing TAP summaries', () => {
  assert.equal(parseTestSummary('irrelevant'), null);
  assert.equal(parseTestSummary(`${tap(2,2,0,0)}\n# tests 2`), null);
  assert.equal(assessTestEvidence({ output: '# pass 1', exitCode: 0 }).status, 'BLOCKED');
});
test('RB1 rejects mismatched counts and nonzero process exits', () => {
  assert.equal(assessTestEvidence({ output: tap(4,5,0,0), exitCode: 0 }).status, 'BLOCKED');
  assert.equal(assessTestEvidence({ output: tap(4,4,0,0), exitCode: 1 }).status, 'BLOCKED');
});
test('RB1 permits complete test evidence but never approves production', () => {
  const result = assessTestEvidence({ output: tap(985,985,0,0), exitCode: 0 });
  assert.equal(result.status, 'TEST_EVIDENCE_COMPLETE');
  assert.equal(result.productionDecision, 'NO_GO');
  assert.deepEqual(result.reasons, []);
});
