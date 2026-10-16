const base = String(process.env.SPOTLY_BASE_URL || "https://spotlyafrica.com").replace(/\/$/, "");
const token = String(process.env.SPOTLY_ID_TOKEN || "").trim();
const checks = [
  { name: "service feed", path: "/api/public/service-feed?service=events&city=Harare&limit=1", expected: [200] },
  { name: "batch marketplace businesses", path: "/api/public/marketplace/businesses?id=__spotly_contract_probe__", expected: [200] },
  { name: "customer activity route exists", path: "/api/customer/activity?limit=10", expected: token ? [200] : [401, 403] },
];

let failed = 0;
for (const check of checks) {
  try {
    const response = await fetch(`${base}${check.path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const ok = check.expected.includes(response.status);
    console.log(`${ok ? "PASS" : "FAIL"} ${check.name}: HTTP ${response.status} (expected ${check.expected.join("/")})`);
    if (!ok) failed += 1;
  } catch (error) {
    console.log(`FAIL ${check.name}: ${error?.cause?.code || error?.name || "network error"}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} iOS production contract check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll iOS production contract checks passed.");
}
