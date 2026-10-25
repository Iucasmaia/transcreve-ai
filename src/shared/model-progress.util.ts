export function progressPercent(loaded: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const percent = Math.round((loaded / total) * 100);
  return Math.min(100, Math.max(0, percent));
}
