import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PREFERRED_MAX = 350;
const REVIEW_MAX = 400;
const HARD_MAX = 600;
const NEW_FILE_MAX = 500;
const ENTRYPOINT_MAX = 120;

const PATHS = ["src", "tests"];

const ENTRYPOINTS = [
  "src/background/index.ts",
  "src/content/index.ts",
  "src/injected/index.ts",
  "src/settings/index.ts",
  "src/offscreen/index.ts",
];

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

function lineCount(file: string): number {
  return readFileSync(file, "utf8").split("\n").length;
}

const failures: string[] = [];
const warnings: string[] = [];

for (const base of PATHS) {
  for (const file of walk(join(ROOT, base))) {
    const name = relative(ROOT, file).replace(/\\/g, "/");
    const lines = lineCount(file);
    if (ENTRYPOINTS.includes(name) && lines > ENTRYPOINT_MAX) {
      failures.push(`${name}: ${lines} lines (entrypoint limit ${ENTRYPOINT_MAX})`);
      continue;
    }
    if (lines > HARD_MAX) {
      failures.push(`${name}: ${lines} lines (hard limit ${HARD_MAX})`);
      continue;
    }
    if (lines > REVIEW_MAX) {
      warnings.push(`${name}: ${lines} lines (preferred ${PREFERRED_MAX}, review ${REVIEW_MAX})`);
      continue;
    }
    if (lines > PREFERRED_MAX && lines > NEW_FILE_MAX) {
      warnings.push(`${name}: ${lines} lines (preferred ${PREFERRED_MAX})`);
    }
  }
}

for (const warning of warnings) {
  console.warn(`warn ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`fail ${failure}`);
  }
  process.exit(1);
}

console.log("file-size: ok");
