export interface ReserveInput {
  hasBox: boolean;
  hasMeta: boolean;
}

export function shouldReserveBox(input: ReserveInput): boolean {
  return input.hasBox && !input.hasMeta;
}

export function applyReserve(box: HTMLElement | null, reserved: boolean): void {
  if (!box || !box.isConnected) return;
  box.classList.toggle("wa-tr-box-reserve", reserved);
}
