import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

const SHARED = "src/shared/";
const FORBIDDEN_FOR_SHARED = [
  "/background/",
  "/content/",
  "/injected/",
  "/settings/",
  "/whisper/",
];
const CONSOLE_ALLOWED = new Set(["src/shared/logger.ts"]);

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

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true);
  const specifiers: string[] = [];
  parsed.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });
  return specifiers;
}

function resolvesToSharedLayer(specifier: string, fromDir: string): string {
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`;
  }
  if (!specifier.startsWith(".")) {
    return "";
  }
  return join(fromDir, specifier).replace(/\\/g, "/");
}

const failures: string[] = [];

for (const file of walk(join(ROOT, "src"))) {
  const name = relative(ROOT, file).replace(/\\/g, "/");
  const dir = name.slice(0, name.lastIndexOf("/"));
  const source = readFileSync(file, "utf8");
  const imports = importsOf(file);

  if (name.startsWith(SHARED)) {
    for (const specifier of imports) {
      const resolved = resolvesToSharedLayer(specifier, dir);
      if (FORBIDDEN_FOR_SHARED.some((forbidden) => resolved.includes(forbidden))) {
        failures.push(`${name}: shared layer importing ${specifier}`);
      }
    }
  }

  if (name.startsWith("src/content/")) {
    for (const specifier of imports) {
      if (specifier.includes("background")) {
        failures.push(`${name}: content importing background (${specifier})`);
      }
    }
  }

  if (name.startsWith("src/injected/")) {
    for (const specifier of imports) {
      const allowed = specifier.startsWith(".") || specifier === "@/shared/types";
      if (!allowed) {
        failures.push(`${name}: injected must stay self-contained (${specifier})`);
      }
    }
  }

  if (!CONSOLE_ALLOWED.has(name) && /\bconsole\.(log|warn|error|info|debug)\s*\(/.test(source)) {
    failures.push(`${name}: console is only allowed in src/shared/logger.ts`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`fail ${failure}`);
  }
  process.exit(1);
}

console.log("boundaries: ok");
