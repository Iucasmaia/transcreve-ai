export interface MeasuredRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TimeLeafMeasurement {
  rect: MeasuredRect;
  textMatches: boolean;
  visible: boolean;
  nested: boolean;
}

const MAX_TIME_WIDTH = 90;

export function isEligibleTimeLeaf(leaf: TimeLeafMeasurement): boolean {
  if (!leaf.textMatches || !leaf.visible || leaf.nested) return false;
  if (leaf.rect.height === 0) return false;
  return leaf.rect.width <= MAX_TIME_WIDTH;
}

export function eligibleTimeLeaves<T extends TimeLeafMeasurement>(leaves: readonly T[]): T[] {
  return leaves.filter(isEligibleTimeLeaf);
}

export interface ClassifiedTimes<T> {
  meta: T | null;
  duration: T | null;
}

export function classifyTimes<T extends TimeLeafMeasurement>(
  leaves: readonly T[],
): ClassifiedTimes<T> {
  const eligible = eligibleTimeLeaves(leaves);
  if (eligible.length === 0) return { meta: null, duration: null };
  if (eligible.length === 1) return { meta: eligible[0] ?? null, duration: null };
  const ordered = [...eligible].sort((left, right) =>
    left.rect.right !== right.rect.right
      ? left.rect.right - right.rect.right
      : left.rect.left - right.rect.left,
  );
  return { meta: ordered[ordered.length - 1] ?? null, duration: ordered[0] ?? null };
}

export interface MetaTargetInput {
  durationTop: number | null;
  metaHome: { top: number; right: number } | null;
  refRect: MeasuredRect;
  metaRect: MeasuredRect;
}

export function metaTarget(input: MetaTargetInput): { top: number; right: number } {
  const top =
    input.durationTop !== null
      ? input.durationTop
      : input.metaHome
        ? input.refRect.top + input.metaHome.top
        : input.metaRect.top;
  const right = input.metaHome ? input.refRect.right - input.metaHome.right : input.metaRect.right;
  return { top, right };
}
