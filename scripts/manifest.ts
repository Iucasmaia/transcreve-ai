import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST_STRINGS } from "../src/shared/i18n/manifest-strings";
import { LOCALE_IDS, type LocaleId } from "../src/shared/types";

export type BrowserTarget = "chrome" | "firefox";

export const LOCALE_DIRECTORIES: Record<LocaleId, string> = {
  en: "en",
  "pt-BR": "pt_BR",
  "pt-PT": "pt_PT",
  es: "es",
  fr: "fr",
  it: "it",
  ru: "ru",
};

const WHATSAPP_MATCH = "https://web.whatsapp.com/*";

const ICONS: Record<string, string> = {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png",
};

const HOST_PERMISSIONS = [
  "https://api.assemblyai.com/*",
  "https://api.openai.com/*",
  "https://generativelanguage.googleapis.com/*",
  "https://huggingface.co/*",
  "https://*.huggingface.co/*",
  "https://*.hf.co/*",
  WHATSAPP_MATCH,
];

const CONTENT_SECURITY_POLICY =
  "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self' blob:";

export function buildManifest(target: BrowserTarget, version: string): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    manifest_version: 3,
    default_locale: "en",
    name: "__MSG_extName__",
    short_name: "Transcreve",
    version,
    description: "__MSG_extDescription__",
    icons: ICONS,
    action: {
      default_icon: ICONS,
      default_popup: "popup.html",
      default_title: "__MSG_actionTitle__",
    },
    background:
      target === "chrome"
        ? { service_worker: "background.js" }
        : { scripts: ["background.js"] },
    content_scripts: [
      {
        js: ["injected.js"],
        matches: [WHATSAPP_MATCH],
        run_at: "document_start",
        world: "MAIN",
      },
      {
        css: ["content.css"],
        js: ["content.js"],
        matches: [WHATSAPP_MATCH],
        run_at: "document_idle",
      },
    ],
    host_permissions: HOST_PERMISSIONS,
    permissions:
      target === "chrome"
        ? ["storage", "scripting", "activeTab", "offscreen"]
        : ["storage", "scripting", "activeTab"],
    content_security_policy: {
      extension_pages: CONTENT_SECURITY_POLICY,
    },
  };

  if (target === "chrome") {
    manifest["options_page"] = "options.html";
  } else {
    manifest["options_ui"] = { page: "options.html", open_in_tab: true };
    manifest["browser_specific_settings"] = {
      gecko: {
        id: "transcreve-ai@lucasmaia.dev",
        strict_min_version: "128.0",
        data_collection_permissions: {
          required: ["none"],
          optional: ["authenticationInfo", "personalCommunications", "websiteContent"],
        },
      },
    };
  }

  return manifest;
}

export function writeLocaleMessages(targetDir: string): void {
  for (const locale of LOCALE_IDS) {
    const strings = MANIFEST_STRINGS[locale];
    const directory = join(targetDir, "_locales", LOCALE_DIRECTORIES[locale]);
    mkdirSync(directory, { recursive: true });
    const messages = {
      extName: { message: strings.extName },
      extDescription: { message: strings.extDescription },
      actionTitle: { message: strings.actionTitle },
    };
    writeFileSync(join(directory, "messages.json"), `${JSON.stringify(messages, null, 2)}\n`);
  }
}
