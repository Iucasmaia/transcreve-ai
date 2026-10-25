import { t } from "@/shared/i18n";
import { log } from "@/shared/logger";
import type { MessageEntry } from "../dom-observer";
import { getPlayerContainer } from "./find";

export type ButtonMode = "avatar" | "dot" | "row" | "float" | "inline";

type ButtonClassSuffix = "avatar" | "dot" | "rowmode" | "float" | "inline";

const MODE_ORDER: readonly ButtonMode[] = ["avatar", "dot", "row", "float", "inline"];
const VISIBILITY_CHECK_MS = 180;

const MIC_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

export function createButton(onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "wa-tr-btn";
  button.title = t("transcribeTitle");
  button.setAttribute("aria-label", t("transcribeAria"));
  button.innerHTML = `<span class="wa-tr-icon">${MIC_SVG}</span><span class="wa-tr-btn-label">${t("transcribe")}</span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

export function refreshButtonState(entry: MessageEntry, done: boolean): void {
  const button = entry.button;
  button.classList.toggle("wa-tr-done", done);
  const label = button.querySelector(".wa-tr-btn-label");
  if (label) label.textContent = done ? t("transcribed") : t("transcribe");
  const iconSlot = button.querySelector(".wa-tr-icon");
  if (iconSlot) iconSlot.innerHTML = done ? CHECK_SVG : MIC_SVG;
  button.title = done ? t("transcribedTitle") : t("transcribeTitle");
  button.setAttribute("aria-label", t("transcribeAria"));
}

function buttonLooksVisible(button: HTMLButtonElement): boolean {
  if (!button.isConnected) return false;
  const rect = button.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(button);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  let node: HTMLElement | null = button.parentElement;
  for (let index = 0; index < 6 && node; index += 1) {
    const computed = window.getComputedStyle(node);
    if (/(hidden|clip)/.test(computed.overflowX) || /(hidden|clip)/.test(computed.overflowY)) {
      const clip = node.getBoundingClientRect();
      if (
        clip.width > 0 &&
        (rect.right > clip.right + 2 ||
          rect.left < clip.left - 2 ||
          rect.bottom > clip.bottom + 2 ||
          rect.top < clip.top - 2)
      ) {
        return false;
      }
    }
    node = node.parentElement;
  }
  return true;
}

function setButtonMode(button: HTMLButtonElement, mode: ButtonClassSuffix): void {
  button.classList.remove(
    "wa-tr-btn-rowmode",
    "wa-tr-btn-float",
    "wa-tr-btn-inline",
    "wa-tr-btn-dot",
    "wa-tr-btn-avatar",
  );
  button.classList.add(`wa-tr-btn-${mode}`);
  button.style.left = "";
  button.style.top = "";
  button.style.right = "";
}

function findAvatar(entry: MessageEntry): HTMLElement | null {
  const balloon = entry.balloon;
  if (!balloon || !balloon.isConnected) return null;
  const balloonRect = balloon.getBoundingClientRect();
  if (balloonRect.width === 0) return null;
  const isAvatarRect = (rect: DOMRect): boolean =>
    rect.width >= 30 &&
    rect.width <= 84 &&
    rect.height >= 30 &&
    rect.height <= 84 &&
    Math.abs(rect.width - rect.height) <= 12 &&
    rect.left + rect.width / 2 > balloonRect.left + balloonRect.width / 2 &&
    rect.top < balloonRect.top + 120;
  for (const image of balloon.querySelectorAll("img")) {
    const holder = image.parentElement ?? image;
    if (isAvatarRect(holder.getBoundingClientRect())) return holder;
    if (isAvatarRect(image.getBoundingClientRect())) return image;
  }
  let best: HTMLElement | null = null;
  let bestArea = -1;
  for (const element of balloon.querySelectorAll("div, span")) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.contains(entry.playEl)) continue;
    const rect = element.getBoundingClientRect();
    if (!isAvatarRect(rect)) continue;
    if (!element.querySelector("svg, img")) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      best = element;
    }
  }
  return best;
}

export function layoutAvatarButton(entry: MessageEntry): void {
  if (entry.mode !== "avatar") return;
  const balloon = entry.balloon;
  const avatar = entry.avatarEl;
  if (!balloon || !balloon.isConnected || !avatar || !avatar.isConnected) return;
  const balloonRect = balloon.getBoundingClientRect();
  const avatarRect = avatar.getBoundingClientRect();
  if (balloonRect.width === 0 || avatarRect.width === 0) return;
  const size = 26;
  const left = avatarRect.left - balloonRect.left - size / 2;
  const top = avatarRect.bottom - balloonRect.top - size / 2;
  entry.button.style.left = `${String(Math.max(0, Math.min(left, balloonRect.width - size)))}px`;
  entry.button.style.top = `${String(Math.max(0, top))}px`;
}

export function layoutFloatButton(entry: MessageEntry): void {
  if (entry.mode !== "float") return;
  const balloon = entry.balloon;
  const playEl = entry.playEl;
  if (!balloon || !balloon.isConnected || !playEl.isConnected) return;
  const size = 28;
  const gap = 8;
  const containerRect = entry.container.getBoundingClientRect();
  const balloonRect = balloon.getBoundingClientRect();
  const playRect = playEl.getBoundingClientRect();
  if (balloonRect.width === 0 || playRect.width === 0) return;
  const spaceRight = containerRect.right - balloonRect.right;
  const spaceLeft = balloonRect.left - containerRect.left;
  let left: number;
  let top: number;
  if (spaceRight >= size + gap) {
    left = balloonRect.width + gap;
    top = playRect.top - balloonRect.top + playRect.height / 2 - size / 2;
  } else if (spaceLeft >= size + gap) {
    left = -size - gap;
    top = playRect.top - balloonRect.top + playRect.height / 2 - size / 2;
  } else {
    left = balloonRect.width - size - 6;
    top = 6;
  }
  entry.button.style.left = `${String(left)}px`;
  entry.button.style.top = `${String(Math.max(0, top))}px`;
}

function attachAvatar(entry: MessageEntry): boolean {
  const balloon = entry.balloon;
  if (!balloon || !balloon.isConnected) return false;
  const avatar = findAvatar(entry);
  if (!avatar) return false;
  entry.avatarEl = avatar;
  if (window.getComputedStyle(balloon).position === "static") balloon.style.position = "relative";
  balloon.appendChild(entry.button);
  setButtonMode(entry.button, "avatar");
  entry.mode = "avatar";
  layoutAvatarButton(entry);
  return true;
}

function attachDot(entry: MessageEntry): boolean {
  const playEl = entry.playEl;
  if (!playEl.isConnected) return false;
  const row = playEl.closest('div[tabindex="-1"]');
  if (!row) return false;
  const playRect = playEl.getBoundingClientRect();
  const playCenterY = playRect.top + playRect.height / 2;
  const band = Math.max(26, playRect.height);
  let waveEl: Element | null = null;
  let bestDist = Infinity;
  let bestWidth = -1;
  for (const element of row.querySelectorAll("*")) {
    if (element === entry.button || element === playEl) continue;
    if (element.contains(playEl) || playEl.contains(element)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 50) continue;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.abs(centerY - playCenterY);
    if (dist > band) continue;
    if (dist < bestDist - 2 || (Math.abs(dist - bestDist) <= 2 && rect.width > bestWidth)) {
      bestDist = dist;
      bestWidth = rect.width;
      waveEl = element;
    }
  }
  setButtonMode(entry.button, "dot");
  if (waveEl && waveEl.parentElement) {
    waveEl.parentElement.insertBefore(entry.button, waveEl.nextSibling);
  } else {
    row.appendChild(entry.button);
  }
  entry.mode = "dot";
  return true;
}

function attachRow(entry: MessageEntry): boolean {
  const container = getPlayerContainer(entry.playEl);
  if (!container || !container.parentElement) return false;
  if (!entry.rowEl) {
    entry.rowEl = document.createElement("div");
    entry.rowEl.className = "wa-tr-btn-row";
  }
  entry.rowEl.appendChild(entry.button);
  setButtonMode(entry.button, "rowmode");
  container.parentElement.insertBefore(entry.rowEl, container.nextSibling);
  entry.mode = "row";
  return true;
}

function attachToBalloon(entry: MessageEntry): boolean {
  const balloon = entry.balloon;
  if (!balloon || !balloon.isConnected) return false;
  if (window.getComputedStyle(balloon).position === "static") balloon.style.position = "relative";
  balloon.appendChild(entry.button);
  setButtonMode(entry.button, "float");
  entry.mode = "float";
  layoutFloatButton(entry);
  return true;
}

function attachInline(entry: MessageEntry): boolean {
  const playEl = entry.playEl;
  if (!playEl.isConnected) return false;
  const anchor = playEl.closest("button") ?? playEl;
  const host = anchor.parentElement;
  if (!host) return false;
  setButtonMode(entry.button, "inline");
  if (anchor.nextSibling) host.insertBefore(entry.button, anchor.nextSibling);
  else host.appendChild(entry.button);
  entry.mode = "inline";
  return true;
}

function attachByMode(entry: MessageEntry, mode: ButtonMode): boolean {
  switch (mode) {
    case "avatar":
      return attachAvatar(entry);
    case "dot":
      return attachDot(entry);
    case "row":
      return attachRow(entry);
    case "float":
      return attachToBalloon(entry);
    case "inline":
      return attachInline(entry);
  }
}

function scheduleVisibilityCheck(entry: MessageEntry): void {
  const modeAtSchedule = entry.mode;
  window.setTimeout(() => {
    if (!entry.button.isConnected) return;
    if (entry.mode !== modeAtSchedule) return;
    if (buttonLooksVisible(entry.button)) return;
    log.warn("botão", `Modo ${String(modeAtSchedule)} ficou invisível; escalando para o próximo modo`);
    if (modeAtSchedule) entry.failedModes[modeAtSchedule] = true;
    attachButton(entry);
  }, VISIBILITY_CHECK_MS);
}

export function attachButton(entry: MessageEntry): void {
  for (const mode of MODE_ORDER) {
    if (entry.failedModes[mode]) continue;
    if (attachByMode(entry, mode)) {
      log.info("botão", `Modo aplicado: ${mode}`, entry.msgId);
      scheduleVisibilityCheck(entry);
      return;
    }
    entry.failedModes[mode] = true;
  }
  log.error("botão", "Nenhum modo de inserção funcionou");
}

export function ensureEntryButton(entry: MessageEntry): void {
  if (!entry.button.isConnected) {
    attachButton(entry);
    return;
  }
  if (entry.mode === "avatar") {
    if (!entry.balloon || entry.button.parentElement !== entry.balloon) attachButton(entry);
    else layoutAvatarButton(entry);
  }
  if (entry.mode === "float") {
    if (entry.balloon && entry.button.parentElement !== entry.balloon) attachToBalloon(entry);
    else layoutFloatButton(entry);
  }
  if (entry.mode === "row" && entry.rowEl && !entry.rowEl.isConnected) {
    attachButton(entry);
  }
}
