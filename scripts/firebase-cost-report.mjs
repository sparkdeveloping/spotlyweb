#!/usr/bin/env node
// Offline analysis of a Google Cloud Billing report exported as CSV.
// This script makes no network or Firebase requests and never prints account IDs.
import { readFileSync } from "node:fs";

function parseCsv(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((entry) => entry.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("Invalid CSV: unclosed quoted cell.");
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function column(header, options) {
  const normalized = header.map((value) => String(value || "").trim().toLowerCase());
  return normalized.findIndex((cell) => options.includes(cell));
}

function amount(raw) {
  const text = String(raw ?? "").trim();
  if (!text || text === "—" || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  const numeric = Number(text.replace(/[$,()\s]/g, ""));
  if (!Number.isFinite(numeric)) throw new Error(`Unrecognized cost amount: ${text.slice(0, 40)}`);
  return negative ? -numeric : numeric;
}

export function summarizeBillingCsv(csv) {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("Billing CSV has no data rows.");
  const header = rows[0];
  const serviceIndex = column(header, ["service", "service description", "service name"]);
  const skuIndex = column(header, ["sku", "sku description", "sku name"]);
  const costIndex = column(header, ["cost", "cost ($)", "unrounded cost", "cost amount"]);
  if (serviceIndex === -1 || skuIndex === -1 || costIndex === -1) {
    throw new Error("Expected Service, SKU, and Cost columns. Export a Google Cloud Billing report grouped by Service / SKU.");
  }
  const services = new Map(), skus = new Map();
  let totalCost = 0, billedRows = 0;
  for (const row of rows.slice(1)) {
    if (!row[serviceIndex] || !row[skuIndex]) continue;
    const service = row[serviceIndex].trim();
    const sku = row[skuIndex].trim();
    const cost = amount(row[costIndex]);
    services.set(service, (services.get(service) || 0) + cost);
    const key = `${service} / ${sku}`;
    skus.set(key, (skus.get(key) || 0) + cost);
    totalCost += cost;
    billedRows++;
  }
  const sorted = (map) => [...map.entries()].map(([name, cost]) => ({ name, cost: Math.round(cost * 1e6) / 1e6 })).sort((a, b) => b.cost - a.cost);
  return { totalCost: Math.round(totalCost * 1e6) / 1e6, billedRows, services: sorted(services), skus: sorted(skus) };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Usage: node scripts/firebase-cost-report.mjs <billing-export.csv> [--json]");
    process.exitCode = 2;
  } else {
    try {
      const report = summarizeBillingCsv(readFileSync(file, "utf8"));
      if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
      else {
        console.log(`Billing export rows: ${report.billedRows}; net cost in export currency: ${report.totalCost.toFixed(2)}`);
        console.log("\nServices:");
        report.services.forEach(({ name, cost }) => console.log(`${cost.toFixed(4).padStart(12)}  ${name}`));
        console.log("\nSKUs:");
        report.skus.slice(0, 40).forEach(({ name, cost }) => console.log(`${cost.toFixed(4).padStart(12)}  ${name}`));
        console.log("\nNote: cost excludes adjustments not represented in the export; verify against the Billing console.");
      }
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
