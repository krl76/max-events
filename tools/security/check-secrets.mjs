#!/usr/bin/env node
// START_MODULE_CONTRACT
// PURPOSE: Detect committed real-looking secrets while allowing explicitly marked example placeholders for local docs/config/test contours.
// SCOPE: Recursively scans text files, OpenCode rules/agents, docs and env examples; excludes dependencies, generated outputs, lockfiles, binary assets. Run from repo root.
// DEPENDS: Node.js fs/path/url modules, process cwd, repo-local text files.
// LINKS: V-M-TOOLS
// END_MODULE_CONTRACT
//
// GREP_SUMMARY: secret scanner, env example placeholders, real-looking keys, docs fixtures, redaction hygiene
// STRUCTURE: repo files -> text candidate filter -> provider/generic rules -> explicit example allow -> finding report
//
// START_MODULE_MAP
// - isExplicitExampleSecret - example/placeholder marker detection
// - isTextCandidate - text-file candidacy filter
// - scanFile - per-file secret rule scan
// - walk - recursive repo file collection
// END_MODULE_MAP

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = process.cwd();

const ignoredDirectories = new Set([".git", "build", "coverage", "dist", "node_modules", "playwright-report", "test-results"]);

const ignoredFiles = new Set(["package-lock.json"]);

const ignoredPathPatterns = [/^\.opencode\/node_modules\//, /^docs\/generated\//];

const allowedPathPatterns = [];

const secretRules = [
  {
    id: "private-key",
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    id: "github-token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/,
  },
  {
    id: "slack-token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/,
  },
  {
    id: "aws-access-key",
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    id: "google-api-key",
    pattern: /AIza[0-9A-Za-z_-]{35}/,
  },
  {
    id: "generic-assignment-secret",
    pattern: /(?:secret|token|password|private[_-]?key|api[_-]?key)\s*[:=]\s*['"][^'"\s]{20,}['"]/i,
    validate: (line, relativePath) => !isExplicitExampleSecret(line, relativePath),
  },
  {
    id: "generic-env-secret-assignment",
    pattern: /^\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z0-9_]*\s*=\s*[^\s#'"]{20,}/,
    validate: (line, relativePath) => isSensitiveEnvAssignment(line) && !isExplicitExampleSecret(line, relativePath),
  },
];

const explicitExampleFragments = ["REPLACE_WITH_", "PLACEHOLDER_", "placeholder-", "-placeholder", "EXAMPLE_", "replace-with-", "change-me", "<example", "example-", "example_", "test-", "test_", "playwright-", "playwright_", "e2e-", "existing-", "mock-", "sample-", "dev-", "local-example-", "dev-example-", "test-", "dummy-", "dummy_", "fake-", "fake_", "<redacted>", "<set>", "<unset>", "postgres://user:pass@localhost", "postgres://user:password@localhost", "postgres://max_events:max_events@localhost", "InjectionToken"];

const explicitExampleLinePattern = /(?:example|sample|placeholder|dummy|fake|redacted|playwright|test)\s+(?:secret|token|password|api[_ -]?key|private[_ -]?key)/i;

const textFileExtensions = new Set([".cjs", ".css", ".env", ".example", ".html", ".js", ".json", ".jsonc", ".jsx", ".md", ".mjs", ".sh", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml"]);

function relative(absolutePath) {
  return path.relative(rootDir, absolutePath).replaceAll(path.sep, "/");
}

function isAllowedPath(relativePath) {
  return allowedPathPatterns.some((pattern) => pattern.test(relativePath));
}

function isIgnoredPath(relativePath) {
  return ignoredPathPatterns.some((pattern) => pattern.test(relativePath));
}

function isTextCandidate(relativePath) {
  if (ignoredFiles.has(path.basename(relativePath)) || isIgnoredPath(relativePath)) {
    return false;
  }

  if (isRuntimeEnvFile(relativePath)) {
    return false;
  }

  const extension = path.extname(relativePath);
  return textFileExtensions.has(extension) || relativePath.includes(".env");
}

function isRuntimeEnvFile(relativePath) {
  const basename = path.basename(relativePath).toLowerCase();
  return basename.includes(".env") && !basename.includes("example") && !basename.includes("sample");
}

function walk(directory, files = []) {
  const absoluteDirectory = path.join(rootDir, directory);
  if (!existsSync(absoluteDirectory)) {
    return files;
  }

  for (const entry of readdirSync(absoluteDirectory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const absoluteEntry = path.join(absoluteDirectory, entry);
    const relativeEntry = relative(absoluteEntry);
    const entryStat = statSync(absoluteEntry);

    if (entryStat.isDirectory()) {
      walk(relativeEntry, files);
      continue;
    }

    if (isTextCandidate(relativeEntry)) {
      files.push(relativeEntry);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function scanFile(relativePath) {
  if (isAllowedPath(relativePath)) {
    return [];
  }

  const content = readFileSync(path.join(rootDir, relativePath), "utf8");
  const findings = [];

  for (const [lineIndex, line] of content.split("\n").entries()) {
    for (const rule of secretRules) {
      if (rule.pattern.test(line) && (rule.validate?.(line, relativePath) ?? true)) {
        findings.push({
          file: relativePath,
          line: lineIndex + 1,
          rule: rule.id,
        });
      }
    }
  }

  return findings;
}

function isExplicitExampleSecret(line, relativePath) {
  if (isDocsOrTestFixture(relativePath) && looksLikeProviderKey(line)) {
    return false;
  }

  return explicitExampleFragments.some((fragment) => line.includes(fragment)) || explicitExampleLinePattern.test(line);
}

function isDocsOrTestFixture(relativePath) {
  return relativePath.startsWith("docs/") || relativePath.startsWith("tests/") || /(?:^|\/)(__tests__|fixtures?|test-data|test_data)(?:\/|$)/.test(relativePath);
}

function isSensitiveEnvAssignment(line) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/);
  const key = match?.[1] ?? "";
  if (!key) return false;
  if (/(?:ALLOWED|ALLOWLIST|ENABLED|EXPIRES|ISSUER|AUDIENCE|COOKIE|PATHS?|DOMAINS?|TTL|SKEW)/.test(key)) {
    return false;
  }
  return /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)/.test(key);
}

function looksLikeProviderKey(line) {
  return secretRules.filter((rule) => rule.id !== "generic-assignment-secret" && rule.id !== "generic-env-secret-assignment").some((rule) => rule.pattern.test(line));
}

function main() {
  const findings = walk(".").flatMap(scanFile);

  if (findings.length > 0) {
    console.error("[secrets] potential secrets detected");
    for (const finding of findings) {
      console.error(`[secrets] ${finding.file}:${finding.line} ${finding.rule}`);
    }
    process.exitCode = 1;
  } else {
    console.log("[secrets] no high-confidence secret patterns detected");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { isExplicitExampleSecret, isTextCandidate, scanFile, walk };
