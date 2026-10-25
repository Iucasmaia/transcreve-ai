import { t } from "@/shared/i18n";
import type { MessageEntry } from "../dom-observer";
import { animateBoxOpen, markOpened, stopTyping, typeText } from "./animation";
import { getPlayerContainer } from "./find";

export type BoxState = "loading" | "done" | "error";

const COPY_RESET_MS = 1600;

export function applyBoxLanguage(box: HTMLElement): void {
  const label = box.querySelector(".wa-tr-label");
  if (label) label.textContent = t("transcription");
  const copy = box.querySelector(".wa-tr-copy");
  if (copy && copy.textContent !== t("copied")) copy.textContent = t("copy");
  const dots = box.querySelector(".wa-tr-dots");
  if (dots) dots.setAttribute("aria-label", t("loading"));
}

async function copyTranscript(box: HTMLElement, copyButton: HTMLElement): Promise<void> {
  const textEl = box.querySelector(".wa-tr-text");
  const text = textEl ? textEl.textContent : "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  copyButton.textContent = t("copied");
  window.setTimeout(() => {
    copyButton.textContent = t("copy");
  }, COPY_RESET_MS);
}

function createResultBox(): HTMLDivElement {
  const box = document.createElement("div");
  box.className = "wa-tr-box";
  box.innerHTML =
    '<div class="wa-tr-head"><span class="wa-tr-label"></span><button type="button" class="wa-tr-copy"></button></div><div class="wa-tr-text"></div><div class="wa-tr-dots" role="status"><span></span><span></span><span></span></div><div class="wa-tr-code"></div>';
  applyBoxLanguage(box);
  const copyButton = box.querySelector(".wa-tr-copy");
  if (copyButton instanceof HTMLElement) {
    copyButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void copyTranscript(box, copyButton);
    });
  }
  return box;
}

function boxAnchor(entry: MessageEntry): { host: HTMLElement; after: Element | null } {
  const playerContainer = getPlayerContainer(entry.playEl);
  const balloon = entry.balloon && entry.balloon.isConnected ? entry.balloon : null;
  let host: HTMLElement = entry.container;
  let after: Element | null = null;
  if (playerContainer && playerContainer.parentElement) {
    host = playerContainer.parentElement;
    after = playerContainer;
  } else if (balloon) {
    host = balloon;
  }
  for (let index = host.children.length - 1; index >= 0; index -= 1) {
    const child = host.children[index];
    if (!child) continue;
    if (child.classList.contains("wa-tr-box") || child.classList.contains("wa-tr-btn-row")) {
      continue;
    }
    if (child !== after) after = child;
    break;
  }
  return { host, after };
}

export function layoutResultBox(entry: MessageEntry): void {
  const box = entry.box;
  if (!box) return;
  box.style.maxWidth = "";
  box.style.marginLeft = "";
  box.style.marginRight = "";
}

export function ensureResultBox(entry: MessageEntry): HTMLDivElement {
  const { host, after } = boxAnchor(entry);
  if (entry.box && entry.box.isConnected && entry.box.parentElement === host) {
    if (after && entry.box.previousElementSibling !== after) {
      host.insertBefore(entry.box, after.nextSibling);
    }
    layoutResultBox(entry);
    return entry.box;
  }
  const box = createResultBox();
  if (after) host.insertBefore(box, after.nextSibling);
  else host.appendChild(box);
  entry.box = box;
  layoutResultBox(entry);
  return box;
}

export function setBoxState(
  box: HTMLDivElement,
  state: BoxState,
  text: string | null = null,
  code: string | null = null,
  instant = false,
): void {
  stopTyping(box);
  const firstOpen = markOpened(box);
  box.dataset.state = state;
  box.classList.toggle("wa-tr-instant", instant);

  const textEl = box.querySelector(".wa-tr-text");
  const copy = box.querySelector(".wa-tr-copy");
  const codeEl = box.querySelector(".wa-tr-code");

  if (copy instanceof HTMLElement) copy.style.display = state === "done" ? "" : "none";
  if (codeEl) codeEl.textContent = code ? t("errorCode", { code }) : "";

  box.style.height = "";
  box.style.maxHeight = "";
  box.style.opacity = "";

  if (state === "done") {
    if (instant) {
      if (textEl) textEl.textContent = text ?? "";
      return;
    }
    typeText(box, text ?? "");
    return;
  }

  if (textEl) textEl.textContent = state === "error" ? (text ?? "") : "";
  if (!instant && firstOpen) animateBoxOpen(box);
}
