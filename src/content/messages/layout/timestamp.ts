import { log } from "@/shared/logger";
import type { MessageEntry } from "../../dom-observer";
import {
  classifyTimes,
  eligibleTimeLeaves,
  metaTarget,
  type MeasuredRect,
  type TimeLeafMeasurement,
} from "./player-meta";
import { applyReserve, shouldReserveBox } from "./reserve";

interface TimeCandidate extends TimeLeafMeasurement {
  el: HTMLElement;
}

interface DescribedElement {
  tag: string;
  cls: string;
  text: string;
  rect: number[];
  pos: string;
}

const TIME_PATTERN = /^\d{1,2}:\d{2}(\s?[aApP][mM])?$/;
const SANITY_MARGIN = 80;
const MAX_DESCRIBE_CLASS = 48;
const MAX_DESCRIBE_TEXT = 24;

export function isWithinMessage(
  target: { top: number; right: number },
  refRect: MeasuredRect,
): boolean {
  if (refRect.height <= 0) return true;
  if (target.top < refRect.top - SANITY_MARGIN) return false;
  if (target.top > refRect.bottom + SANITY_MARGIN) return false;
  if (target.right < refRect.left - SANITY_MARGIN) return false;
  if (target.right > refRect.right + SANITY_MARGIN) return false;
  return true;
}

export function anchorOffset(
  target: { top: number; right: number },
  anchorRect: MeasuredRect,
): { top: number; right: number } {
  return { top: target.top - anchorRect.top, right: anchorRect.right - target.right };
}

export type Placement = { kind: "pinned"; top: number; right: number } | { kind: "out-of-bounds" };

export function resolvePlacement(input: {
  target: { top: number; right: number };
  anchorRect: MeasuredRect;
  refRect: MeasuredRect;
}): Placement {
  if (!isWithinMessage(input.target, input.refRect)) return { kind: "out-of-bounds" };
  const offset = anchorOffset(input.target, input.anchorRect);
  return { kind: "pinned", top: offset.top, right: offset.right };
}

function measureCandidates(scope: Element): TimeCandidate[] {
  const candidates: TimeCandidate[] = [];
  for (const node of scope.querySelectorAll("div, span")) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.classList.contains("wa-tr-box") || node.classList.contains("wa-tr-btn")) continue;
    const textMatches = TIME_PATTERN.test(node.textContent.trim());
    let visible = true;
    try {
      const style = window.getComputedStyle(node);
      visible = style.display !== "none" && style.visibility !== "hidden";
    } catch {
      visible = true;
    }
    candidates.push({
      el: node,
      rect: node.getBoundingClientRect(),
      textMatches,
      visible,
      nested: false,
    });
  }
  return candidates;
}

function markNested(candidates: readonly TimeCandidate[]): void {
  for (const candidate of candidates) {
    for (const other of candidates) {
      if (other === candidate) continue;
      if (other.el.contains(candidate.el)) {
        candidate.nested = true;
        break;
      }
    }
  }
}

function measureMetaHome(entry: MessageEntry): void {
  const meta = entry.metaEl;
  if (!meta || !meta.isConnected) return;
  const ref = entry.root;
  if (!ref.isConnected) return;
  const refRect = ref.getBoundingClientRect();
  const metaRect = meta.getBoundingClientRect();
  if (refRect.width <= 0 || metaRect.width <= 0) return;
  entry.metaHome = { top: metaRect.top - refRect.top, right: refRect.right - metaRect.right };
}

function describeElement(el: Element | null): DescribedElement | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  let pos = "";
  try {
    pos = window.getComputedStyle(el).position;
  } catch {
    pos = "";
  }
  const cls = el.className;
  return {
    tag: el.tagName,
    cls: cls.slice(0, MAX_DESCRIBE_CLASS),
    text: el.textContent.trim().slice(0, MAX_DESCRIBE_TEXT),
    rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
    pos,
  };
}

function logMetaDiagnostic(entry: MessageEntry, durationEl: HTMLElement | null): void {
  const described = describeElement(entry.metaEl);
  const signature = described ? `${described.tag}.${described.cls}:${described.text}` : "none";
  if (entry.diagDone && entry.diagMetaSig === signature) return;
  entry.diagDone = true;
  entry.diagMetaSig = signature;
  log.info(
    "DOM",
    "diagnóstico",
    JSON.stringify({
      msgId: entry.msgId,
      root: describeElement(entry.root),
      container: describeElement(entry.container),
      balloon: describeElement(entry.balloon),
      meta: described,
      duration: describeElement(durationEl),
      metaHome: entry.metaHome,
      state: entry.metaLog,
    }),
  );
}

function pinMeta(
  meta: HTMLElement,
  top: number,
  right: number,
  durationEl: HTMLElement | null,
): void {
  if (meta.dataset.waTrPinned !== "1") {
    meta.dataset.waTrOrigStyle = meta.getAttribute("style") ?? "";
    meta.dataset.waTrPinned = "1";
  }
  meta.style.setProperty("position", "absolute", "important");
  meta.style.setProperty("top", `${String(top)}px`, "important");
  meta.style.setProperty("right", `${String(right)}px`, "important");
  meta.style.setProperty("bottom", "auto", "important");
  meta.style.setProperty("left", "auto", "important");
  meta.style.setProperty("float", "none", "important");
  meta.style.setProperty("z-index", "6", "important");
  meta.style.setProperty("white-space", "nowrap", "important");
  if (durationEl && durationEl !== meta) {
    const style = window.getComputedStyle(durationEl);
    meta.style.setProperty("--wa-tr-meta-size", style.fontSize);
    meta.style.setProperty("--wa-tr-meta-font", style.fontFamily);
    meta.style.setProperty("--wa-tr-meta-weight", style.fontWeight);
    meta.style.setProperty("--wa-tr-meta-lh", style.lineHeight);
    meta.dataset.waTrFont = "1";
  } else {
    delete meta.dataset.waTrFont;
  }
}

export function restoreMeta(entry: MessageEntry): void {
  const meta = entry.metaEl;
  if (!meta || meta.dataset.waTrPinned !== "1") return;
  const original = meta.dataset.waTrOrigStyle ?? "";
  if (original) meta.setAttribute("style", original);
  else meta.removeAttribute("style");
  delete meta.dataset.waTrPinned;
  delete meta.dataset.waTrOrigStyle;
  delete meta.dataset.waTrFont;
}

function applyMeta(entry: MessageEntry, durationEl: HTMLElement | null): void {
  const meta = entry.metaEl;
  if (!meta || !meta.isConnected) {
    entry.metaLog = "sem-meta";
    return;
  }
  let anchor: Element | null = null;
  try {
    anchor = meta.offsetParent;
  } catch {
    anchor = null;
  }
  if (!anchor || !anchor.isConnected) anchor = entry.balloon;
  if (!anchor || !anchor.isConnected) {
    entry.metaLog = "sem-anchor";
    return;
  }
  const anchorRect = anchor.getBoundingClientRect();
  const metaRect = meta.getBoundingClientRect();
  const refRect = entry.root.getBoundingClientRect();
  const durationTop =
    durationEl && durationEl.isConnected ? durationEl.getBoundingClientRect().top : null;
  const target = metaTarget({ durationTop, metaHome: entry.metaHome, refRect, metaRect });
  const placement = resolvePlacement({ target, anchorRect, refRect });
  if (placement.kind === "out-of-bounds") {
    entry.metaLog = "alvo-fora";
    restoreMeta(entry);
    return;
  }
  entry.metaLog = "pinned";
  pinMeta(meta, placement.top, placement.right, durationEl);
}

export function syncMeta(entry: MessageEntry): void {
  const measured = measureCandidates(entry.root);
  const survivors = eligibleTimeLeaves(measured);
  markNested(survivors);
  const classified = classifyTimes(survivors);
  const stable =
    entry.metaEl !== null &&
    entry.metaEl.isConnected &&
    entry.durationEl !== null &&
    entry.durationEl.isConnected;
  const meta = stable ? entry.metaEl : (classified.meta?.el ?? entry.metaEl);
  const duration = stable ? entry.durationEl : (classified.duration?.el ?? entry.durationEl);
  entry.metaEl = meta;
  entry.durationEl = duration;
  const hasBox = entry.box !== null && entry.box.isConnected;

  if (!meta) {
    applyReserve(entry.box, shouldReserveBox({ hasBox, hasMeta: false }));
    if (hasBox && entry.metaLog !== "notfound") {
      entry.metaLog = "notfound";
      log.warn("meta", "Horário não encontrado na mensagem; caixa com reserva inferior", entry.msgId);
    }
    return;
  }

  if (!hasBox) {
    restoreMeta(entry);
    measureMetaHome(entry);
    entry.metaLog = "natural";
    return;
  }

  applyReserve(entry.box, shouldReserveBox({ hasBox, hasMeta: true }));
  applyMeta(entry, duration);
  logMetaDiagnostic(entry, duration);
  if (entry.metaLog !== "pinned") {
    entry.metaLog = "pinned";
    log.info(
      "meta",
      "Horário ancorado na linha da duração (lado direito); fonte igualada à da duração",
      entry.msgId,
    );
  }
}
