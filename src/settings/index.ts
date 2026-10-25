import { DEFAULT_PROVIDER } from "@/shared/settings.schema";
import { t } from "@/shared/i18n";
import { readStoredSettings, writeStoredSettings } from "@/shared/storage.store";
import { buildDraftFields, createDrafts, draftKeyValue, hydrateDrafts, resolveProvider, storeDraftValues, type SettingsDrafts } from "./drafts";
import { mountCachePanel } from "./cache-panel";
import { applyUiLanguage, toUiLanguageSetting } from "./i18n-bindings";
import { PROVIDER_CATALOG } from "./providers.catalog";
import { createThemeToggle } from "./theme";
import { mountLocalModelBlock } from "./local-model";
import { required, setStatus } from "./panel-dom";

function syncKeyToggleLabel(): void {
  toggleKeyButton.textContent = apiKeyInput.type === "password" ? t("show") : t("hide");
}
function renderProvider(): void {
  const entry = PROVIDER_CATALOG[drafts.provider];
  providerSelect.value = drafts.provider;
  keyRow.style.display = entry.keyField === null ? "none" : "";
  apiKeyInput.value = draftKeyValue(drafts, drafts.provider);
  apiKeyInput.placeholder = t("apiKeyPlaceholder", { provider: entry.label });
  keyHint.textContent = t(entry.hintKey);
  modelRow.style.display = entry.modelField === null ? "none" : "";
  if (entry.modelField !== null) {
    modelInput.value = drafts.models[drafts.provider];
    modelInput.placeholder = entry.defaultModel ?? "";
    modelOptions.replaceChildren(...entry.models.map((name) => new Option(name, name)));
    modelHint.textContent = t("defaultModel", { model: entry.defaultModel ?? "" });
  }
  localModel.show(drafts.provider);
}
function buildPayload(): Record<string, unknown> {
  const autoMode = autoModeSelect.value;
  return {
    provider: drafts.provider,
    languageMode: modeManual.checked ? "manual" : "auto",
    languageCode: languageSelect.value || "pt",
    autoMode: autoMode === "chat" || autoMode === "all" ? autoMode : "off",
    autoContacts: autoContacts.checked,
    autoGroups: autoGroups.checked,
    autoChannels: autoChannels.checked,
    ...buildDraftFields(drafts),
  };
}

const themeToggle = required<HTMLButtonElement>("#themeToggle"); const uiLanguageSelect = required<HTMLSelectElement>("#uiLanguage");
const providerSelect = required<HTMLSelectElement>("#provider"); const keyRow = required<HTMLElement>("#keyRow");
const apiKeyInput = required<HTMLInputElement>("#apiKey"); const toggleKeyButton = required<HTMLButtonElement>("#toggleKey");
const keyHint = required<HTMLElement>("#keyHint"); const modelRow = required<HTMLElement>("#modelRow");
const modelInput = required<HTMLInputElement>("#model"); const modelOptions = required<HTMLDataListElement>("#modelOptions");
const modelHint = required<HTMLElement>("#modelHint"); const modeAuto = required<HTMLInputElement>("#modeAuto");
const modeManual = required<HTMLInputElement>("#modeManual"); const languageSelect = required<HTMLSelectElement>("#languageCode");
const autoModeSelect = required<HTMLSelectElement>("#autoMode"); const autoContacts = required<HTMLInputElement>("#autoContacts");
const autoGroups = required<HTMLInputElement>("#autoGroups"); const autoChannels = required<HTMLInputElement>("#autoChannels");
const saveButton = required<HTMLButtonElement>("#save"); const status = required<HTMLElement>("#status");
const cacheStatus = required<HTMLElement>("#cacheStatus");
let drafts: SettingsDrafts = createDrafts(DEFAULT_PROVIDER);
const theme = createThemeToggle(themeToggle);
const localModel = mountLocalModelBlock();
const cachePanel = mountCachePanel((text, kind) => setStatus(cacheStatus, text, kind));

async function load(): Promise<void> {
  const stored = await readStoredSettings();
  applyUiLanguage(uiLanguageSelect, toUiLanguageSetting(stored.uiLanguage));
  theme.apply(stored.panelTheme);
  syncKeyToggleLabel();
  const resolution = resolveProvider(stored.provider);
  drafts = hydrateDrafts(stored, resolution.provider);
  if (resolution.replaced) {
    await writeStoredSettings({ provider: resolution.provider });
  }
  modeManual.checked = stored.languageMode === "manual";
  languageSelect.value = stored.languageCode;
  autoModeSelect.value = stored.autoMode;
  autoContacts.checked = stored.autoContacts;
  autoGroups.checked = stored.autoGroups;
  autoChannels.checked = stored.autoChannels;
  languageSelect.disabled = !modeManual.checked;
  renderProvider();
  await cachePanel.refresh();
}

providerSelect.addEventListener("change", () => {
  storeDraftValues(drafts, apiKeyInput.value, modelInput.value);
  drafts.provider = resolveProvider(providerSelect.value).provider;
  renderProvider();
  if (drafts.provider === "local") localModel.start(drafts.models.local);
  void writeStoredSettings({ provider: drafts.provider }).then(() => setStatus(status, t("saved"), "ok"));
});
uiLanguageSelect.addEventListener("change", () => {
  storeDraftValues(drafts, apiKeyInput.value, modelInput.value);
  const setting = toUiLanguageSetting(uiLanguageSelect.value);
  applyUiLanguage(uiLanguageSelect, setting);
  renderProvider();
  syncKeyToggleLabel();
  theme.refresh();
  void writeStoredSettings({ uiLanguage: setting });
  void cachePanel.refresh();
});
toggleKeyButton.addEventListener("click", () => {
  apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  syncKeyToggleLabel();
});
for (const radio of [modeAuto, modeManual]) {
  radio.addEventListener("change", () => {
    languageSelect.disabled = !modeManual.checked;
  });
}

saveButton.addEventListener("click", () => {
  storeDraftValues(drafts, apiKeyInput.value, modelInput.value);
  void writeStoredSettings(buildPayload()).then(() => setStatus(status, t("saved"), "ok"));
});
void load();
