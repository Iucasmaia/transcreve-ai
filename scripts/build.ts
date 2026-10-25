import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildManifest, writeLocaleMessages, type BrowserTarget } from "./manifest";
import { vendorRuntime } from "./vendor";

const TARGETS: readonly BrowserTarget[] = ["chrome", "firefox"];

interface EntryPoint {
  out: string;
  entry: string;
}

const SHARED_ENTRY_POINTS: readonly EntryPoint[] = [
  { out: "background", entry: "src/background/index.ts" },
  { out: "content", entry: "src/content/index.ts" },
  { out: "injected", entry: "src/injected/index.ts" },
  { out: "settings", entry: "src/settings/index.ts" },
  { out: "whisper-worker", entry: "src/whisper/worker.ts" },
];

const CHROME_ENTRY_POINTS: readonly EntryPoint[] = [
  { out: "offscreen", entry: "src/offscreen/index.ts" },
];

const watch = process.argv.includes("--watch");

function readVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  if (typeof parsed === "object" && parsed !== null && "version" in parsed) {
    const version = (parsed as { version?: unknown }).version;
    if (typeof version === "string") {
      return version;
    }
  }
  throw new Error("package.json has no version");
}

async function buildTarget(target: BrowserTarget, version: string): Promise<void> {
  const outdir = join("dist", target);
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  const entryPoints = [
    ...SHARED_ENTRY_POINTS,
    ...(target === "chrome" ? CHROME_ENTRY_POINTS : []),
  ].map((point) => ({ in: point.entry, out: point.out }));

  await build({
    entryPoints,
    outdir,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: target === "chrome" ? ["chrome120"] : ["firefox128"],
    alias: { "@": "./src" },
    minify: !watch,
    sourcemap: watch ? "inline" : false,
    logLevel: "warning",
  });

  cpSync("public", outdir, { recursive: true });
  writeLocaleMessages(outdir);
  vendorRuntime(join(outdir, "vendor"));
  writeFileSync(
    join(outdir, "manifest.json"),
    `${JSON.stringify(buildManifest(target, version), null, 2)}\n`,
  );
  console.log(`built dist/${target}`);
}

const version = readVersion();
for (const target of TARGETS) {
  await buildTarget(target, version);
}

if (watch) {
  const { watch: watchFiles } = await import("node:fs");
  const rebuild = (): void => {
    void Promise.all(TARGETS.map((target) => buildTarget(target, version)));
  };
  watchFiles("src", { recursive: true }, rebuild);
  watchFiles("public", { recursive: true }, rebuild);
  console.log("watching src/ and public/");
}
