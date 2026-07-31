#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOOGLE_SERVICES_PATH = resolve(__dirname, "..", "android", "app", "google-services.json");
const EXPECTED_PACKAGE = "com.testerswap.salamandra";

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

let raw;
try {
  raw = readFileSync(GOOGLE_SERVICES_PATH, "utf8");
} catch (err) {
  fail(`Cannot read ${GOOGLE_SERVICES_PATH}: ${err.message}`);
}

let cfg;
try {
  cfg = JSON.parse(raw);
} catch (err) {
  fail(`Invalid JSON: ${err.message}`);
}

if (!cfg.project_info || !cfg.project_info.project_id || cfg.project_info.project_id.startsWith("YOUR_")) {
  fail("project_info.project_id is still a placeholder. Download real google-services.json from Firebase Console.");
}
ok(`project_id = ${cfg.project_info.project_id}`);

if (!cfg.project_info.project_number || cfg.project_info.project_number.startsWith("YOUR_")) {
  fail("project_info.project_number is still a placeholder.");
}
ok(`project_number = ${cfg.project_info.project_number}`);

if (!Array.isArray(cfg.client) || cfg.client.length === 0) {
  fail("client[] is empty. The google-services.json should contain at least one Android client.");
}

const androidClient = cfg.client.find((c) => c.client_info && c.client_info.android_client_info);
if (!androidClient) {
  fail("No Android client_info found in google-services.json.");
}

const pkg = androidClient.client_info.android_client_info.package_name;
if (pkg !== EXPECTED_PACKAGE) {
  fail(`Android package_name mismatch: expected '${EXPECTED_PACKAGE}', got '${pkg}'. Download google-services.json for the correct Firebase Android app.`);
}
ok(`android package_name = ${pkg}`);

if (!androidClient.api_key || !Array.isArray(api_key_or_keys(androidClient))) {
  fail("api_key missing or malformed.");
}
ok("api_key present");

console.log("\n🎉 google-services.json validation passed.\n");
console.log("Next steps:");
console.log("1. Enable Cloud Messaging API in Google Cloud Console");
console.log("2. Add google-services.json to git if not already tracked");
console.log("3. Run: npx cap sync android");

function api_key_or_keys(client) {
  return client.api_key ? [client.api_key] : client.api_keys || [];
}
