interface BoxMotion {
  openToken: number;
  typingRaf: number | null;
  opened: boolean;
}

const motions = new WeakMap<HTMLElement, BoxMotion>();

const MIN_TYPING_DURATION_MS = 380;
const MAX_TYPING_DURATION_MS = 1500;
const TYPING_MS_PER_CHAR = 14;
const OPEN_SETTLE_MS = 420;

function motionOf(box: HTMLElement): BoxMotion {
  const existing = motions.get(box);
  if (existing) return existing;
  const created: BoxMotion = { openToken: 0, typingRaf: null, opened: false };
  motions.set(box, created);
  return created;
}

export function markOpened(box: HTMLElement): boolean {
  const motion = motionOf(box);
  const firstOpen = !motion.opened;
  motion.opened = true;
  return firstOpen;
}

export function stopTyping(box: HTMLElement): void {
  const motion = motions.get(box);
  if (motion && motion.typingRaf !== null) {
    window.cancelAnimationFrame(motion.typingRaf);
    motion.typingRaf = null;
  }
}

export function animateBoxOpen(box: HTMLElement): void {
  const motion = motionOf(box);
  motion.openToken += 1;
  const token = motion.openToken;
  const target = box.scrollHeight;
  if (!target) return;
  box.style.maxHeight = "0px";
  box.style.opacity = "0";
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (motion.openToken !== token || motion.typingRaf) return;
      box.style.maxHeight = `${String(target)}px`;
      box.style.opacity = "1";
      window.setTimeout(() => {
        if (motion.openToken !== token || motion.typingRaf) return;
        box.style.maxHeight = "";
        box.style.opacity = "";
      }, OPEN_SETTLE_MS);
    });
  });
}

export function typeText(box: HTMLElement, text: string): void {
  stopTyping(box);
  const motion = motionOf(box);
  motion.openToken += 1;
  box.style.maxHeight = "";
  box.style.opacity = "";
  const textEl = box.querySelector(".wa-tr-text");
  if (!(textEl instanceof HTMLElement)) return;
  if (!text) {
    textEl.textContent = "";
    box.style.height = "";
    return;
  }
  const border = box.offsetHeight - box.clientHeight;
  box.style.height = `${String(box.offsetHeight)}px`;
  const total = text.length;
  const duration = Math.max(
    MIN_TYPING_DURATION_MS,
    Math.min(MAX_TYPING_DURATION_MS, total * TYPING_MS_PER_CHAR),
  );
  let startedAt: number | null = null;
  let shown = -1;
  let lastHeight = -1;

  const grow = (): void => {
    const target = box.scrollHeight + border;
    if (target !== lastHeight) {
      lastHeight = target;
      box.style.height = `${String(target)}px`;
    }
  };

  const frame = (timestamp: number): void => {
    if (startedAt === null) startedAt = timestamp;
    const progress = Math.min(1, (timestamp - startedAt) / duration);
    const count = Math.min(total, Math.max(1, Math.round(total * progress)));
    if (count !== shown) {
      shown = count;
      textEl.textContent = text.slice(0, count);
      grow();
    }
    if (progress < 1) {
      motion.typingRaf = window.requestAnimationFrame(frame);
    } else {
      textEl.textContent = text;
      motion.typingRaf = null;
      box.style.height = "";
      box.style.maxHeight = "";
    }
  };

  motion.typingRaf = window.requestAnimationFrame(frame);
}
