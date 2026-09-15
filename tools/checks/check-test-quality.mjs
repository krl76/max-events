#!/usr/bin/env node
// START_MODULE_CONTRACT
// PURPOSE: Scan all test files across the monorepo for forbidden anti-patterns AND behavioral defects (syntax-invalid, empty-body, assertion-free, mock-only, orphaned) and print a quality report. Exit non-zero on any ERROR.
// SCOPE: All workspace + root test files matching **/*.{test,spec}.{ts,tsx,mjs}. Read-only, no file mutations.
// DEPENDS: Node.js fs, path, module. esbuild (syntax parse) + picomatch (orphan glob match), resolved from the repo root.
// LINKS: .opencode/rules/31-test-discipline.md, V-M-TOOLS
// END_MODULE_CONTRACT
//
// GREP_SUMMARY: test quality linter, anti-pattern scanner, syntax-invalid, empty test body, no assertions, mock-only, orphan test file, GRACE markup, only skip, sleep setTimeout, file size, describe count, snapshot
// STRUCTURE: discover test files -> harvest config include globs -> per-file regex+behavior checks -> global orphan check -> aggregate -> report -> exit
//
// START_MODULE_MAP
// - checkFile - run all per-file checks, return violations
// - MOCK_ONLY_ALLOWLIST - legacy mock-only offenders allowlist (do not extend)
// END_MODULE_MAP

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const PROJECT_ROOT = process.cwd();
const require = createRequire(join(PROJECT_ROOT, "package.json"));

// Optional deps resolved from repo root; degrade gracefully if unavailable.
let esbuild = null;
let picomatch = null;
try {
  esbuild = require("esbuild");
} catch {
  /* SYNTAX_INVALID skipped */
}
try {
  picomatch = require("picomatch");
} catch {
  /* ORPHAN skipped */
}

const EXCLUDE_DIRS = new Set([".git", "node_modules", "coverage", "dist", "build", ".next", "docs/generated", ".turbo", ".omo"]);

const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx|mjs)$/;

const SCAN_TARGETS = ["apps", "packages", "tools", "tests"];

const EXCLUDE_FILES = new Set([]);

const MAX_FILE_LINES = 500;
// One-describe-per-file was too strict and fed the same fragmentation. Allow related describes;
// only warn when a file crams in an excessive number (kitchen-sink smell).
const MAX_DESCRIBE_BLOCKS = 6;

const REGEX_CHECKS = [
  {
    id: "GRACE_MARKUP_IN_TESTS",
    severity: "ERROR",
    message: "GRACE semantic markup forbidden in test files",
    pattern: /\bSTART_MODULE_CONTRACT\b|\bSTART_MODULE_MAP\b|\bSTART_CHANGE_SUMMARY\b|\bSTART_CONTRACT\b|\bSTART_BLOCK_\w+\b|\bEND_BLOCK_\w+\b|\bGREP_SUMMARY\b|\bSTRUCTURE\b/,
    advice: "Remove GRACE markup from test files. Use plain test names and direct assertions.",
  },
  {
    id: "ONLY_OR_SKIP",
    severity: "ERROR",
    message: ".only or .skip committed",
    pattern: /\b(?:describe|it|test|suite)\s*\.(?:only|skip)\s*\(/,
    advice: "Remove .only/.skip. Fix the test instead of masking it.",
  },
  {
    id: "SLEEP_SYNC",
    severity: "ERROR",
    message: "sleep() or setTimeout(resolve) for synchronization in test file",
    pattern: /await\s+sleep\s*\(|\bsetTimeout\s*\(.*\bresolve\b|await\s+new\s+Promise\s*\([^)]*setTimeout\s*\(/s,
    advice: "Use subscribe-before-trigger + vi.advanceTimersByTimeAsync or explicit timeout circuit-breaker.",
  },
  {
    id: "SNAPSHOT_PROMPT",
    severity: "WARN",
    message: "toMatchSnapshot() — guard behavior, not text diff",
    pattern: /toMatchSnapshot\s*\(/,
    advice: "Assert the structural invariant the prompt enforces, not the current wording.",
  },
];

// Detects an it()/test() whose arrow body is empty: it('name', () => {}) / it('name', async () => {}).
const EMPTY_BODY_RE = /\b(?:it|test)\s*\(\s*(['"`])(?:[^'"`\\]|\\.)*\1\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;
// Any assertion style: expect()/expectTypeOf()/assertType()/assert()/assert.method().
const ASSERTION_RE = /\b(?:expect|expectTypeOf|assertType)\s*\(|\bassert\s*\(|\bassert\.[a-zA-Z]/;
const HAS_TESTCASE_RE = /\b(?:it|test)\s*\(/;
const EXPECT_CALL_RE = /\bexpect\s*\(/g;
const CALLED_MATCHER_RE = /\.(?:toHaveBeenCalled|toHaveBeenCalledWith|toHaveBeenCalledTimes|toHaveBeenCalledOnce|toBeCalled|toBeCalledWith|toBeCalledTimes|toHaveBeenLastCalledWith|toHaveBeenNthCalledWith)\b/g;
const NODE_TEST_IMPORT_RE = /from\s*['"]node:test['"]/;

// Legacy MOCK_ONLY_ASSERTIONS offenders. Adding new files here is FORBIDDEN; fix the test instead.
const MOCK_ONLY_ALLOWLIST = new Set([]);

/**
 * @typedef {{ file: string, ruleId: string, severity: string, message: string, advice: string, line?: number }} Violation
 */

function collectTestFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectTestFiles(fullPath));
    else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) results.push(fullPath);
  }
  return results;
}

function collectConfigFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectConfigFiles(fullPath));
    else if (entry.isFile() && /(?:vitest[.\w-]*\.config|playwright\.config)\.(?:ts|mts|js|mjs|cjs)$/.test(entry.name)) results.push(fullPath);
  }
  return results;
}

const DEFAULT_VITEST_INCLUDE = "**/*.{test,spec}.?(c|m)[jt]s?(x)";

/** Resolve a vitest config's `root` to an absolute path (best-effort, no eval). */
function resolveConfigRoot(configPath, content) {
  const dir = dirname(configPath);
  const lit = content.match(/\broot:\s*(['"`])([^'"`]+)\1/);
  if (lit) return resolve(dir, lit[2]);
  const id = content.match(/\broot:\s*([A-Za-z_$][\w$]*)/);
  if (id) {
    const name = id[1];
    const viaUrl = content.match(new RegExp(`\\b${name}\\s*=\\s*fileURLToPath\\(\\s*new URL\\(\\s*(['"\`])([^'"\`]+)\\1`));
    if (viaUrl) return resolve(dir, viaUrl[2]);
    const viaResolve = content.match(new RegExp(`\\b${name}\\s*=\\s*(?:path\\.)?resolve\\(\\s*(?:__dirname|process\\.cwd\\(\\))\\s*,\\s*(['"\`])([^'"\`]+)\\1`));
    if (viaResolve) return resolve(dir, viaResolve[2]);
  }
  return dir;
}

/** Build picomatch matchers for every test-glob any config declares (over-collect = safe for orphan). */
function harvestIncludeMatchers() {
  if (!picomatch) return null;
  const matchers = [];
  const add = (base, glob) => {
    if (glob.startsWith("!")) return; // ignore negations for reachability
    // Normalize to POSIX separators: picomatch treats "\" as an escape char, so native Windows
    // paths from resolve() would never match — making every test file a false ORPHAN on Windows.
    const abs = resolve(base, glob).replace(/\\/g, "/");
    try {
      matchers.push(picomatch(abs, { dot: true }));
    } catch {
      /* skip bad glob */
    }
  };
  for (const cfg of collectConfigFiles(PROJECT_ROOT)) {
    let content;
    try {
      content = readFileSync(cfg, "utf8");
    } catch {
      continue;
    }
    const isPlaywright = /playwright\.config\./.test(cfg);
    if (isPlaywright) {
      const dirMatch = content.match(/\btestDir:\s*(['"`])([^'"`]+)\1/);
      const base = dirMatch ? resolve(dirname(cfg), dirMatch[2]) : dirname(cfg);
      add(base, "**/*.@(spec|test).?(c|m)[jt]s?(x)");
      continue;
    }
    const root = resolveConfigRoot(cfg, content);
    // any quoted string that looks like a test glob (has * and test|spec)
    const globs = [...content.matchAll(/(['"`])([^'"`]*\*[^'"`]*)\1/g)].map((m) => m[2]).filter((g) => /(?:test|spec)/.test(g));
    if (globs.length === 0) {
      add(root, DEFAULT_VITEST_INCLUDE); // config relies on vitest default include
    } else {
      for (const g of globs) add(root, g);
    }
  }
  return matchers;
}

function syntaxCheck(filePath, content) {
  if (!esbuild) return null;
  const loader = filePath.endsWith(".tsx") ? "tsx" : filePath.endsWith(".ts") ? "ts" : "js";
  try {
    esbuild.transformSync(content, { loader });
    return null;
  } catch (e) {
    const err = e?.errors?.[0];
    return { text: err?.text || String(e?.message || e).split("\n")[0], line: err?.location?.line };
  }
}

/**
 * @param {string} filePath
 * @param {(fp:string)=>boolean} isReachable
 * @returns {Violation[]}
 */
function checkFile(filePath, isReachable) {
  const violations = [];
  let content = "";
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return violations;
  }
  const relPath = relative(PROJECT_ROOT, filePath);
  const lines = content.split("\n");
  const push = (id, severity, message, advice, line) => violations.push({ file: relPath, ruleId: id, severity, message, advice, line });

  // --- regex checks ---
  for (const check of REGEX_CHECKS) {
    const match = check.pattern.exec(content);
    if (match) push(check.id, check.severity, check.message, check.advice, content.substring(0, match.index).split("\n").length);
  }

  // --- file size ---
  if (lines.length > MAX_FILE_LINES) {
    push("FILE_TOO_LARGE", "ERROR", `Test file exceeds ${MAX_FILE_LINES} lines (${lines.length})`, `Split by behavior, or extract shared setup into a *.testHarness helper. Ceiling is ${MAX_FILE_LINES}.`);
  }

  // --- excessive describe blocks (soft) ---
  const describeCount = (content.match(/^\s*describe\s*\(/gm) || []).length;
  if (describeCount > MAX_DESCRIBE_BLOCKS) {
    push("EXCESSIVE_DESCRIBE", "WARN", `${describeCount} describe() blocks in one file (> ${MAX_DESCRIBE_BLOCKS})`, "Related describes for one SUT are fine; this many suggests unrelated concerns — split them.");
  }

  // --- SYNTAX_INVALID ---
  const syn = syntaxCheck(filePath, content);
  if (syn) {
    push("SYNTAX_INVALID", "ERROR", `Test file does not parse: ${syn.text}`, "Fix the syntax error — a test that cannot parse never runs (silently 'green').", syn.line);
  }

  // --- EMPTY_TEST_BODY ---
  for (const m of content.matchAll(EMPTY_BODY_RE)) {
    push("EMPTY_TEST_BODY", "ERROR", "it()/test() with an empty body asserts nothing", "Fill with a real behavioral assertion or delete the placeholder.", content.substring(0, m.index).split("\n").length);
  }

  // --- NO_ASSERTIONS (only when the file actually declares test cases and isn't syntax-broken) ---
  const isNodeTest = NODE_TEST_IMPORT_RE.test(content);
  if (!syn && HAS_TESTCASE_RE.test(content) && !ASSERTION_RE.test(content)) {
    push("NO_ASSERTIONS", "ERROR", "Test file declares it()/test() but contains zero assertions", "Add expect()/assert on observable behavior. A no-assertion test can only pass, never fail.");
  }

  // --- MOCK_ONLY_ASSERTIONS (only-called-matcher tests block) ---
  const expectCount = (content.match(EXPECT_CALL_RE) || []).length;
  const calledCount = (content.match(CALLED_MATCHER_RE) || []).length;
  if (expectCount > 0 && calledCount >= expectCount && !MOCK_ONLY_ALLOWLIST.has(relPath)) {
    push("MOCK_ONLY_ASSERTIONS", "ERROR", `Every expect() is a call-matcher (${calledCount}/${expectCount}) — asserts wiring, not outcome`, "Assert the resulting state/return/invariant, not only that a mock was called.");
  }

  // --- ORPHAN_TEST_FILE (advisory; node:test files run outside vitest) ---
  if (isReachable && !isNodeTest && !isReachable(filePath)) {
    push("ORPHAN_TEST_FILE", "WARN", "Test file is not matched by any vitest/playwright include glob — it never runs", "Move it under a covered path, fix the config include, or delete it.");
  }

  return violations;
}

function scanAll() {
  const matchers = harvestIncludeMatchers();
  // Match on POSIX-normalized paths (see harvestIncludeMatchers) so Windows backslash paths match too.
  const isReachable = matchers ? (fp) => matchers.some((m) => m(fp.replace(/\\/g, "/"))) : null;

  /** @type {Violation[]} */
  const allViolations = [];
  for (const target of SCAN_TARGETS) {
    const absPath = resolve(PROJECT_ROOT, target);
    if (!existsSync(absPath)) continue;
    for (const file of collectTestFiles(absPath)) {
      if (EXCLUDE_FILES.has(relative(PROJECT_ROOT, file))) continue;
      allViolations.push(...checkFile(file, isReachable));
    }
  }
  return allViolations;
}

function printReport(violations) {
  if (violations.length === 0) {
    console.log("✓ No test quality violations found.");
    return;
  }
  const errCount = violations.filter((v) => v.severity === "ERROR").length;
  const warnCount = violations.filter((v) => v.severity === "WARN").length;
  console.log(`\n✗ ${errCount} error(s), ${warnCount} warning(s)\n`);

  // errors first, then warnings; grouped by rule for readability
  const order = ["ERROR", "WARN"];
  for (const sev of order) {
    for (const v of violations.filter((x) => x.severity === sev)) {
      const prefix = sev === "ERROR" ? "✗" : "⚠";
      const loc = v.line ? `:${v.line}` : "";
      console.log(`${prefix} ${v.ruleId.padEnd(24)} ${v.file}${loc}`);
      console.log(`  ${v.message}`);
      console.log(`  → ${v.advice}\n`);
    }
  }
}

function main() {
  const violations = scanAll();
  printReport(violations);
  if (violations.some((v) => v.severity === "ERROR")) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

export { checkFile, MOCK_ONLY_ALLOWLIST };
