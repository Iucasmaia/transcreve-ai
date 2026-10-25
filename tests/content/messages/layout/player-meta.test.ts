import { describe, expect, it } from "vitest";
import {
  classifyTimes,
  eligibleTimeLeaves,
  isEligibleTimeLeaf,
  metaTarget,
  type MeasuredRect,
  type TimeLeafMeasurement,
} from "@/content/messages/layout/player-meta";

function rect(left: number, top: number, width: number, height: number): MeasuredRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function leaf(
  left: number,
  top: number,
  width: number,
  height: number,
  flags: Partial<{ textMatches: boolean; visible: boolean; nested: boolean }> = {},
): TimeLeafMeasurement {
  return {
    rect: rect(left, top, width, height),
    textMatches: flags.textMatches ?? true,
    visible: flags.visible ?? true,
    nested: flags.nested ?? false,
  };
}

describe("isEligibleTimeLeaf", () => {
  it("aceita folha com largura zero, desde que tenha altura", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 0, 18))).toBe(true);
  });

  it("rejeita folha com altura zero", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 40, 0))).toBe(false);
  });

  it("rejeita folha mais larga que o teto de 90px", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 91, 18))).toBe(false);
  });

  it("aceita folha exatamente no limite de largura", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 90, 18))).toBe(true);
  });

  it("rejeita folha invisível", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 40, 18, { visible: false }))).toBe(false);
  });

  it("rejeita folha aninhada em outra", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 40, 18, { nested: true }))).toBe(false);
  });

  it("rejeita folha cujo texto não é horário", () => {
    expect(isEligibleTimeLeaf(leaf(10, 0, 40, 18, { textMatches: false }))).toBe(false);
  });
});

describe("eligibleTimeLeaves", () => {
  it("remove folhas aninhadas mantendo a mais externa", () => {
    const outer = leaf(100, 0, 40, 18);
    const inner = leaf(100, 0, 40, 18, { nested: true });
    expect(eligibleTimeLeaves([inner, outer])).toEqual([outer]);
  });
});

describe("classifyTimes", () => {
  it("devolve horário e duração nulos sem folhas", () => {
    expect(classifyTimes([])).toEqual({ meta: null, duration: null });
  });

  it("trata uma única folha como horário", () => {
    const only = leaf(100, 0, 40, 18);
    const result = classifyTimes([only]);
    expect(result.meta).toBe(only);
    expect(result.duration).toBeNull();
  });

  it("classifica por X: o horário é a folha mais à direita", () => {
    const duration = leaf(100, 0, 30, 18);
    const meta = leaf(200, 0, 40, 18);
    const result = classifyTimes([meta, duration]);
    expect(result.meta).toBe(meta);
    expect(result.duration).toBe(duration);
  });

  it("com as duas folhas na mesma linha escolhe o X mais à direita", () => {
    const duration = leaf(150, 200, 30, 18);
    const meta = leaf(300, 200, 45, 18);
    const result = classifyTimes([duration, meta]);
    expect(result.meta).toBe(meta);
    expect(result.duration).toBe(duration);
  });

  it("desempata pelo X esquerdo quando o X direito coincide", () => {
    const lowerX = leaf(140, 0, 60, 18);
    const higherX = leaf(150, 0, 50, 18);
    const result = classifyTimes([higherX, lowerX]);
    expect(result.meta).toBe(higherX);
    expect(result.duration).toBe(lowerX);
  });

  it("ignora folhas aninhadas duplicadas e mantém a mais externa", () => {
    const outer = leaf(200, 0, 40, 18);
    const inner = leaf(200, 0, 40, 18, { nested: true });
    const other = leaf(100, 0, 30, 18);
    const result = classifyTimes([outer, inner, other]);
    expect(result.meta).toBe(outer);
    expect(result.duration).toBe(other);
  });
});

describe("metaTarget", () => {
  const refRect = rect(0, 0, 300, 600);

  it("usa o topo da duração quando ela existe", () => {
    const target = metaTarget({
      durationTop: 500,
      metaHome: { top: 10, right: 20 },
      refRect,
      metaRect: rect(200, 100, 50, 18),
    });
    expect(target).toEqual({ top: 500, right: 280 });
  });

  it("recorre à posição natural quando não há duração", () => {
    const target = metaTarget({
      durationTop: null,
      metaHome: { top: 10, right: 20 },
      refRect,
      metaRect: rect(200, 100, 50, 18),
    });
    expect(target).toEqual({ top: 10, right: 280 });
  });

  it("recorre ao retângulo do horário sem referência salva", () => {
    const target = metaTarget({
      durationTop: null,
      metaHome: null,
      refRect,
      metaRect: rect(200, 100, 50, 18),
    });
    expect(target).toEqual({ top: 100, right: 250 });
  });
});
