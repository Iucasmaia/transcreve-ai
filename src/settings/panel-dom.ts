export type StatusKind = "ok" | "error" | "";

export function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) {
    throw new Error(selector);
  }
  return found;
}

export function setStatus(element: HTMLElement, text: string, kind: StatusKind): void {
  element.textContent = text;
  element.className = kind === "" ? "status" : `status status-${kind}`;
}
