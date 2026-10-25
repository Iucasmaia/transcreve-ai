import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TARGETS = ["chrome", "firefox"] as const;
const ASSET = /\.(js|html|css|png|json)$/;
const REMOTE_SOURCE = /(src|script-src)[^;]*https?:\/\//;
const DATA_COLLECTION_VALUES = [
  "authenticationInfo",
  "bookmarksInfo",
  "browsingActivity",
  "financialAndPaymentInfo",
  "healthInfo",
  "locationInfo",
  "personalCommunications",
  "personallyIdentifyingInfo",
  "searchTerms",
  "technicalAndInteraction",
  "websiteActivity",
  "websiteContent",
];

interface ManifestLike {
  [key: string]: unknown;
}

function readManifest(targetDir: string): ManifestLike {
  const parsed: unknown = JSON.parse(readFileSync(join(targetDir, "manifest.json"), "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("manifest is not an object");
  }
  return parsed as ManifestLike;
}

function collectPaths(value: unknown, found: Set<string>): void {
  if (typeof value === "string") {
    if (ASSET.test(value) && !value.startsWith("__MSG_")) {
      found.add(value.replace(/^\//, ""));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPaths(item, found);
    }
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      collectPaths(item, found);
    }
  }
}

const failures: string[] = [];

for (const target of TARGETS) {
  const targetDir = join("dist", target);
  if (!existsSync(targetDir)) {
    failures.push(`${target}: dist/${target} missing (run the build)`);
    continue;
  }
  const manifest = readManifest(targetDir);
  const paths = new Set<string>();
  collectPaths(manifest, paths);
  for (const path of paths) {
    if (!existsSync(join(targetDir, path))) {
      failures.push(`${target}: manifest references missing ${path}`);
    }
  }

  const csp = JSON.stringify(manifest.content_security_policy ?? {});
  if (REMOTE_SOURCE.test(csp)) {
    failures.push(`${target}: CSP allows a remote script source`);
  }

  const localeDir = join(targetDir, "_locales");
  const locales = existsSync(localeDir) ? readdirSync(localeDir).length : 0;
  if (locales !== 7) {
    failures.push(`${target}: expected 7 locales, found ${locales}`);
  }

  if (target === "firefox") {
    const gecko = (manifest["browser_specific_settings"] as { gecko?: Record<string, unknown> } | undefined)?.gecko;
    const permissions = gecko?.["data_collection_permissions"] as
      | { required?: unknown; optional?: unknown }
      | undefined;
    if (!permissions) {
      failures.push("firefox: data_collection_permissions is missing");
    } else {
      const required = permissions["required"];
      const optional = permissions["optional"];
      if (!Array.isArray(required) || required.length === 0) {
        failures.push("firefox: data_collection_permissions.required must be a non-empty array");
      } else if (
        !required.every(
          (value: unknown) =>
            value === "none" ||
            (typeof value === "string" && DATA_COLLECTION_VALUES.includes(value)),
        )
      ) {
        failures.push("firefox: data_collection_permissions.required has an unknown value");
      } else if (required.includes("none") && required.length > 1) {
        failures.push("firefox: data_collection_permissions.required cannot mix none with other values");
      }
      if (
        optional !== undefined &&
        (!Array.isArray(optional) ||
          optional.length === 0 ||
          !optional.every(
            (value: unknown) =>
              typeof value === "string" && DATA_COLLECTION_VALUES.includes(value),
          ))
      ) {
        failures.push("firefox: data_collection_permissions.optional has an unknown value");
      }
    }
  }

  const shortName = manifest["short_name"];
  if (typeof shortName === "string" && shortName.length > 12) {
    failures.push(`${target}: short_name has ${shortName.length} chars (limit 12)`);
  }

  for (const locale of existsSync(localeDir) ? readdirSync(localeDir) : []) {
    const file = join(localeDir, locale, "messages.json");
    if (!existsSync(file)) {
      continue;
    }
    const messages: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof messages !== "object" || messages === null) {
      failures.push(`${target}/${locale}: messages.json is not an object`);
      continue;
    }
    const record = messages as Record<string, { message?: unknown }>;
    const name = record["extName"]?.message;
    const description = record["extDescription"]?.message;
    if (typeof name !== "string" || name.length > 75) {
      failures.push(`${target}/${locale}: extName must be a string with at most 75 chars`);
    }
    if (typeof description !== "string" || description.length > 132) {
      failures.push(`${target}/${locale}: extDescription must be a string with at most 132 chars`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`fail ${failure}`);
  }
  process.exit(1);
}

console.log("manifest: ok");
