/** LX6 local release *evidence* gate; never a regulatory authorization decision.
 * Example: node scripts/lx6-release-evidence.mjs country=ZW service=ride report=./admin-export.json
 * Needs a JSON export of GET /api/admin/launch-readiness after authenticated admin review.
 * An export is not an attestation, and the original documents must still be validated.
 */
import { readFileSync } from 'node:fs';
const opts = Object.fromEntries(process.argv.slice(2).map((x) => x.split(/=(.*)/s).slice(0,2)));
const { country, service, report } = opts;
if (!country || !service || !report) {
  console.error('NO-GO: supply country=ZW|MW service=ride|send|business report=./admin-export.json');
  process.exitCode = 2;
} else {
  try {
    const audit = JSON.parse(readFileSync(report,'utf8'));
    const matches = Array.isArray(audit.countryCompliance) ? audit.countryCompliance.filter((r) => r.country === country && r.service === service) : [];
    if (matches.length !== 1 || matches[0].ready !== true || matches[0].blockers?.length) {
      console.error(`NO-GO ${country}/${service}: missing reviewer evidence in release export.`);
      process.exitCode = 1;
    } else {
      console.log(`EVIDENCE-RECORDED ${country}/${service}: admin export reports complete evidence. Legal counsel and operational sign-off still required.`);
    }
  } catch (error) {
    console.error(`NO-GO: cannot examine export: ${error.code || error.message}`);
    process.exitCode = 1;
  }
}
