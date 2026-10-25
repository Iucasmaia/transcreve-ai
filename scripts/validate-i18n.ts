import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { en } from "../src/shared/i18n/locales/en";
import * as es from "../src/shared/i18n/locales/es";
import * as fr from "../src/shared/i18n/locales/fr";
import * as it from "../src/shared/i18n/locales/it";
import * as ptBR from "../src/shared/i18n/locales/pt-BR";
import * as ptPT from "../src/shared/i18n/locales/pt-PT";
import * as ru from "../src/shared/i18n/locales/ru";

const ROOT = process.cwd();

const locales: Record<string, Record<string, string>> = {
  "pt-BR": ptBR.ptBR,
  "pt-PT": ptPT.ptPT,
  es: es.es,
  fr: fr.fr,
  it: it.it,
  ru: ru.ru,
};

function walk(directory: string, extension: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full, extension));
      continue;
    }
    if (entry.endsWith(extension)) {
      files.push(full);
    }
  }
  return files;
}

const failures: string[] = [];

const englishKeys = new Set(Object.keys(en));

for (const [locale, messages] of Object.entries(locales)) {
  const keys = new Set(Object.keys(messages));
  for (const key of englishKeys) {
    if (!keys.has(key)) {
      failures.push(`${locale}: missing key ${key}`);
    }
  }
  for (const key of keys) {
    if (!englishKeys.has(key)) {
      failures.push(`${locale}: extra key ${key}`);
    }
  }
}

const usedKeys = new Set<string>();

for (const file of walk(join(ROOT, "public"), ".html")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/data-i18n="([^"]+)"/g)) {
    const key = match[1];
    if (key) {
      usedKeys.add(key);
    }
  }
}

for (const file of walk(join(ROOT, "src"), ".ts")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*"([^"]+)"/g)) {
    const key = match[1];
    if (key) {
      usedKeys.add(key);
    }
  }
  for (const match of source.matchAll(/\b(?:hintKey|defaultModel)\s*:\s*"([^"]+)"/g)) {
    const key = match[1];
    if (key && englishKeys.has(key)) {
      usedKeys.add(key);
    }
  }
}

for (const key of usedKeys) {
  if (!englishKeys.has(key)) {
    failures.push(`unknown i18n key used: ${key}`);
  }
}

for (const key of englishKeys) {
  if (!usedKeys.has(key) && !key.startsWith("ext")) {
    console.warn(`warn i18n key never used: ${key}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`fail ${failure}`);
  }
  process.exit(1);
}

console.log("i18n: ok");
