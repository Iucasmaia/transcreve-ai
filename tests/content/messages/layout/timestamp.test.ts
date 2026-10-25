import { describe, expect, it } from "vitest";
import {
  anchorOffset,
  isWithinMessage,
  resolvePlacement,
} from "@/content/messages/layout/timestamp";
import type { MeasuredRect } from "@/content/messages/layout/player-meta";

function rect(left: number, top: number, width: number, height: number): MeasuredRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

const refRect = rect(0, 100, 300, 600);

describe("isWithinMessage", () => {
  it("aceita alvo dentro dos limites da mensagem", () => {
    expect(isWithinMessage({ top: 300, right: 250 }, refRect)).toBe(true);
  });

  it("aceita alvo exatamente no limite de 80px acima", () => {
    expect(isWithinMessage({ top: 20, right: 250 }, refRect)).toBe(true);
  });

  it("rejeita alvo acima do limite", () => {
    expect(isWithinMessage({ top: 19, right: 250 }, refRect)).toBe(false);
  });

  it("rejeita alvo abaixo do limite", () => {
    expect(isWithinMessage({ top: 781, right: 250 }, refRect)).toBe(false);
    expect(isWithinMessage({ top: 780, right: 250 }, refRect)).toBe(true);
  });

  it("rejeita alvo à esquerda do limite", () => {
    expect(isWithinMessage({ top: 300, right: -81 }, refRect)).toBe(false);
    expect(isWithinMessage({ top: 300, right: -80 }, refRect)).toBe(true);
  });

  it("rejeita alvo à direita do limite", () => {
    expect(isWithinMessage({ top: 300, right: 381 }, refRect)).toBe(false);
    expect(isWithinMessage({ top: 300, right: 380 }, refRect)).toBe(true);
  });

  it("não valida contra referência sem altura", () => {
    expect(isWithinMessage({ top: 99999, right: 99999 }, rect(0, 0, 300, 0))).toBe(true);
  });
});

describe("anchorOffset", () => {
  it("permite top e right negativos", () => {
    const offset = anchorOffset({ top: -20, right: 500 }, rect(0, 100, 300, 600));
    expect(offset).toEqual({ top: -120, right: -200 });
  });

  it("converte coordenadas globais para o sistema do offsetParent", () => {
    const offset = anchorOffset({ top: 200, right: 280 }, rect(10, 50, 200, 400));
    expect(offset).toEqual({ top: 150, right: -70 });
  });
});

describe("resolvePlacement", () => {
  it("ancora com offsets relativos ao offsetParent", () => {
    const placement = resolvePlacement({
      target: { top: 300, right: 250 },
      anchorRect: rect(0, 100, 300, 600),
      refRect,
    });
    expect(placement).toEqual({ kind: "pinned", top: 200, right: 50 });
  });

  it("devolve out-of-bounds quando o alvo sai da mensagem", () => {
    const placement = resolvePlacement({
      target: { top: 5000, right: 250 },
      anchorRect: rect(0, 100, 300, 600),
      refRect,
    });
    expect(placement).toEqual({ kind: "out-of-bounds" });
  });

  it("não faz clamp: preserva offsets negativos", () => {
    const placement = resolvePlacement({
      target: { top: 20, right: 250 },
      anchorRect: rect(0, 100, 300, 600),
      refRect,
    });
    expect(placement).toEqual({ kind: "pinned", top: -80, right: 50 });
  });
});
