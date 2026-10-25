import { log } from "@/shared/logger";

const VOICE_SELECTORS: readonly string[] = [
  'button:has([data-icon="audio-play"])',
  'button:has([data-icon="audio-pause"])',
  'button:has([data-icon="ptt-play"])',
  'button:has([data-icon="ptt-pause"])',
  '[data-icon="audio-play"]',
  '[data-icon="audio-pause"]',
  '[data-icon="ptt-play"]',
  '[data-testid="audio-play"]',
  '[data-testid="ptt-play"]',
  'button[aria-label="Reproduzir mensagem de voz"]',
  'button[aria-label="Pausar mensagem de voz"]',
  'button[aria-label="Play voice message"]',
  'button[aria-label="Pause voice message"]',
  'button[aria-label="Reproducir mensaje de voz"]',
  'button[aria-label="Pausar mensaje de voz"]',
];

const CONTAINER_SELECTOR = [
  ".message-in",
  ".message-out",
  '[data-testid="msg-container"]',
  "[data-id]",
  '[role="row"]',
].join(", ");

let activeSelector: string | null = null;

export function extractMsgId(el: Element): string | null {
  const direct = el.closest("[data-id]");
  if (direct instanceof HTMLElement && direct.dataset.id) return direct.dataset.id;
  const row = el.closest('[role="row"]');
  const inner = row ? row.querySelector("[data-id]") : null;
  if (inner instanceof HTMLElement && inner.dataset.id) return inner.dataset.id;
  let node: Element | null = el;
  for (let index = 0; index < 12 && node && node !== document.body; index += 1) {
    const id = node.getAttribute("data-id");
    if (id && id.indexOf("@") > 0 && id.indexOf("_") > 0) return id;
    node = node.parentElement;
  }
  return null;
}

function isVoiceMessageAnchor(anchor: Element | null): boolean {
  if (!anchor || !anchor.isConnected) return false;
  if (anchor.closest("footer")) return false;
  const main = document.querySelector("#main");
  if (main && !main.contains(anchor)) return false;
  return extractMsgId(anchor) !== null;
}

export function collectPlayElements(): HTMLElement[] {
  const found = new Set<Element>();
  const ordered: HTMLElement[] = [];

  const trySelector = (selector: string): number => {
    let nodes: NodeListOf<Element>;
    try {
      nodes = document.querySelectorAll(selector);
    } catch (error) {
      log.warn("scan", `Seletor não suportado: ${selector}`, String(error));
      return 0;
    }
    let added = 0;
    for (const node of nodes) {
      const anchor = node instanceof HTMLButtonElement ? node : (node.closest("button") ?? node);
      if (!found.has(anchor) && isVoiceMessageAnchor(anchor) && anchor instanceof HTMLElement) {
        found.add(anchor);
        ordered.push(anchor);
        added += 1;
      }
    }
    return added;
  };

  if (activeSelector) trySelector(activeSelector);
  for (const selector of VOICE_SELECTORS) {
    if (selector === activeSelector) continue;
    const before = ordered.length;
    trySelector(selector);
    if (!activeSelector && ordered.length > before) {
      activeSelector = selector;
      log.info("scan", `Seletor vencedor: ${selector}`);
    }
  }
  return ordered;
}

export function findMsgContainer(el: Element): HTMLElement | null {
  const found = el.closest(CONTAINER_SELECTOR);
  if (found instanceof HTMLElement) return found;
  return el.parentElement;
}

export function findMsgRoot(el: Element): Element | null {
  return (
    el.closest('[data-testid="msg-container"]') ??
    el.closest("[data-id]") ??
    el.closest('[role="row"]')
  );
}

export function getPlayerContainer(playEl: Element): HTMLElement | null {
  if (!playEl.isConnected) return null;
  const inner = playEl.closest('div[tabindex="-1"]');
  if (!(inner instanceof HTMLElement)) return null;
  const parent = inner.parentElement;
  return parent ? parent.parentElement : null;
}

export function findBalloon(playEl: Element, container: Element): HTMLElement | null {
  let containerWidth = 0;
  try {
    containerWidth = container.getBoundingClientRect().width;
  } catch {
    containerWidth = 0;
  }
  let rootWidth = 0;
  try {
    const root = findMsgRoot(playEl);
    if (root) rootWidth = root.getBoundingClientRect().width;
  } catch {
    rootWidth = 0;
  }
  const maxBalloonWidth = Math.max(containerWidth, rootWidth) * 0.97 || 900;
  let fallback: HTMLElement | null = null;
  let node: Element = playEl;
  for (let index = 0; index < 9; index += 1) {
    const parent = node.parentElement;
    if (!parent) break;
    node = parent;
    const rect = node.getBoundingClientRect();
    if (rect.width > 90 && rect.width < maxBalloonWidth && !fallback && node instanceof HTMLElement) {
      fallback = node;
    }
    if (node === container) break;
    let background = "";
    try {
      background = window.getComputedStyle(node).backgroundColor;
    } catch {
      background = "";
    }
    if (background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)") {
      if (rect.width > 90 && rect.width < maxBalloonWidth && node instanceof HTMLElement) return node;
    }
  }
  return fallback;
}
