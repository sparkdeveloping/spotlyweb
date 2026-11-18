#!/usr/bin/env node
/** U17 offline target preflight to prevent release scripts from pointing at production Firebase.
 * Run before any emulator/rehearsal shell command. This is NOT cloud authorization.
 */
export function checkStagingTarget(environment) {
  const issues = [];
  const project = String(environment.GCLOUD_PROJECT || environment.FIREBASE_PROJECT_ID || '');
  if (!/^demo-spotly-[a-z0-9-]{3,50}$/.test(project)) issues.push('An explicit demo-spotly-* emulator project is required');
  if (environment.GCLOUD_PROJECT && environment.FIREBASE_PROJECT_ID && environment.GCLOUD_PROJECT !== environment.FIREBASE_PROJECT_ID) issues.push('Firebase and GCloud project IDs differ');
  const required = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST'];
  for (const key of required) {
    const value = String(environment[key] || '');
    if (!/^(?:127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(value)) issues.push(`${key} must point to a local emulator`);
  }
  if (environment.FUNCTIONS_EMULATOR_HOST && !/^(?:127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(environment.FUNCTIONS_EMULATOR_HOST)) issues.push('Functions must be local if defined');
  if (/^(true|1)$/i.test(environment.SPOTLY_ALLOW_PRODUCTION_DEPLOY || '')) issues.push('Production deployment override is forbidden in Wave E rehearsal');
  return { assessment: issues.length ? 'BLOCKED' : 'STAGING_EMULATORS_ONLY', productionDecision: 'NO_GO', blockers: issues };
}
if (process.argv[1]?.endsWith('/wave-e-staging-safety.mjs')) {
  const result = checkStagingTarget(process.env);
  console.log(JSON.stringify(result, null, 2));
  if (result.assessment !== 'STAGING_EMULATORS_ONLY') process.exitCode = 2;
}
