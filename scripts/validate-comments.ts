import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_DIRS = ["src", "tests"];
const STATIC_DIR = "public";
const STATIC_EXTENSIONS = [".css", ".html"];

interface Finding {
  file: string;
  line: number;
  text: string;
}

function walk(directory: string, extensions: readonly string[]): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full, extensions));
      continue;
    }
    if (extensions.some((extension) => entry.endsWith(extension))) {
      files.push(full);
    }
  }
  return files;
}

function lineOf(source: string, position: number): number {
  return source.slice(0, position).split("\n").length;
}

function scriptComments(file: string): Finding[] {
  const source = readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true);
  return [
    ...(ts.getLeadingCommentRanges(source, 0) ?? []),
    ...parsed.getChildren().flatMap((node) => [
      ...(ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(source, node.getEnd()) ?? []),
    ]),
  ].map((range) => ({
    file,
    line: lineOf(source, range.pos),
    text: source.slice(range.pos, range.end).split("\n")[0] ?? "",
  }));
}

function staticComments(file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  let insideBlock = false;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (insideBlock || trimmed.startsWith("/*") || trimmed.startsWith("<!--")) {
      findings.push({ file, line: index + 1, text: trimmed });
    }
    if (trimmed.includes("*/") || trimmed.includes("-->")) {
      insideBlock = false;
      return;
    }
    insideBlock = trimmed.startsWith("/*") || trimmed.startsWith("<!--");
  });
  return findings;
}

const findings = [
  ...walk(join(ROOT, SOURCE_DIRS[0] ?? "src"), [".ts"]).flatMap(scriptComments),
  ...walk(join(ROOT, SOURCE_DIRS[1] ?? "tests"), [".ts"]).flatMap(scriptComments),
  ...walk(join(ROOT, STATIC_DIR), STATIC_EXTENSIONS).flatMap(staticComments),
];

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.text}`);
  }
  console.error(`\n${findings.length} comment(s) found. Rules: AGENTS.md (zero comments).`);
  process.exit(1);
}

console.log("comments: ok");
