import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const TARGETS = ["chrome", "firefox"] as const;

function readVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  if (typeof parsed === "object" && parsed !== null && "version" in parsed) {
    const value = (parsed as { version?: unknown }).version;
    if (typeof value === "string") {
      return value;
    }
  }
  throw new Error("package.json has no version");
}

function zipWithDotNet(directory: string, output: string): void {
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$src = (Resolve-Path '${directory}').Path`,
    `$out = '${output}'`,
    "if (Test-Path $out) { Remove-Item $out -Force }",
    "$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')",
    "Get-ChildItem -Path $src -Recurse -File | ForEach-Object {",
    "  $rel = $_.FullName.Substring($src.Length + 1).Replace('\\', '/')",
    "  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null",
    "}",
    "$zip.Dispose()",
  ].join("; ");
  execFileSync("powershell", ["-NoProfile", "-Command", script], { stdio: "inherit" });
}

function zipWithCommand(directory: string, output: string): void {
  execFileSync("zip", ["-qr", output, "."], { cwd: directory, stdio: "inherit" });
}

const version = readVersion();
const directory = join("dist");

for (const target of TARGETS) {
  const source = join(directory, target);
  if (!existsSync(source)) {
    throw new Error(`${source} missing — run yarn build first`);
  }
  const output = join(process.cwd(), `transcreve-ai-${version}-${target}.zip`);
  if (existsSync(output)) {
    rmSync(output, { force: true });
  }
  if (process.platform === "win32") {
    zipWithDotNet(source, output);
  } else {
    zipWithCommand(source, output);
  }
  console.log(`packaged transcreve-ai-${version}-${target}.zip`);
}
