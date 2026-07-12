#!/usr/bin/env node
/*
 * Build-time hard block for ClickUp workspace 9017065181.
 *
 * The brief requires: "Hard-block workspace 9017065181 in code — not a
 * convention, a check that fails the build if that ID appears in any request."
 *
 * This runs as `prebuild` (npm runs it automatically before `build`). It scans
 * the source tree for the blocked ID literal. The ONLY place it is allowed to
 * appear is the guard definition (lib/clickup.js), where it is declared as the
 * value to block. Anywhere else — a hardcoded request path, a config, a stray
 * fetch — fails the build with a non-zero exit code.
 */
const fs = require("fs");
const path = require("path");

const BLOCKED_ID = "9017065181";
const ROOT = path.resolve(__dirname, "..");

// The blocked ID may only appear in these files (guard definition + this check).
const ALLOWED_FILES = new Set([
  path.join("lib", "clickup.js"),
  path.join("scripts", "check-workspace-guard.js"),
]);

const SCAN_DIRS = ["app", "lib", "components", "db", "scripts"];
const SCAN_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".sql", ".json", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".next"]);

const offenders = [];

function scanFile(abs) {
  const rel = path.relative(ROOT, abs);
  if (ALLOWED_FILES.has(rel)) return;
  let content;
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return;
  }
  if (content.includes(BLOCKED_ID)) {
    const line = content.split("\n").findIndex((l) => l.includes(BLOCKED_ID)) + 1;
    offenders.push(`${rel}:${line}`);
  }
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else if (SCAN_EXT.has(path.extname(entry.name))) scanFile(abs);
  }
}

for (const d of SCAN_DIRS) walk(path.join(ROOT, d));

if (offenders.length) {
  console.error(
    `\n✗ BUILD BLOCKED: forbidden ClickUp workspace ${BLOCKED_ID} referenced outside the guard:`
  );
  for (const o of offenders) console.error(`    ${o}`);
  console.error(
    `\nThe only allowed workspace is 90141390262. Remove every reference to ${BLOCKED_ID}.\n`
  );
  process.exit(1);
}

console.log(`✓ workspace guard: no forbidden references to ${BLOCKED_ID}.`);
