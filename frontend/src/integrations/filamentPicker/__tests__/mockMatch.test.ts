import { describe, expect, it } from "vitest";
import { createMockMatch } from "../mockMatch";

describe("filament match mock", () => {
  it("matches each channel by its color, regardless of LUT channel order", () => {
    const response = createMockMatch({
      palette: "RYBW",
      channels: [
        { label: "W", hex: "#D7D2CF", name: "白" },
        { label: "R", hex: "#E94A39", name: "红" },
        { label: "Y", hex: "#ECEF35", name: "黄" },
        { label: "B", hex: "#3451B1", name: "蓝" },
      ],
      max_alternatives: 2,
    });

    expect(response.slots.map((slot) => slot.best?.name)).toEqual(["浅灰", "猩红", "黄", "钴蓝"]);
    expect(response.slots.map((slot) => slot.input_hex)).toEqual(["#D7D2CF", "#E94A39", "#ECEF35", "#3451B1"]);
    expect(response.slots.map((slot) => slot.label)).toEqual(["W", "R", "Y", "B"]);
  });

  it("keeps every alternative name paired with its own swatch and uses both Pinduoduo URL kinds", () => {
    const response = createMockMatch({
      channels: [{ hex: "#FFFFFF" }],
      max_alternatives: 2,
    });
    const slot = response.slots[0];
    expect(slot?.alternatives).toHaveLength(2);
    const knownHexByName: Record<string, string> = {
      玉石白: "#FFFFFF",
      浅灰: "#D1D3D5",
      黄: "#F4EE2A",
      猩红: "#DE4343",
      红色: "#C12E1F",
      钴蓝: "#0056B8",
      蓝色: "#0A2989",
      青: "#0086D6",
      品红: "#EC008C",
      黑色: "#000000",
      橙色: "#FF6A13",
      拓竹绿: "#00AE42",
      粉色: "#F55A74",
      紫色: "#5E43B7",
      棕色: "#9D432C",
      柠檬黄: "#F7D959",
    };
    for (const candidate of [slot?.best, ...(slot?.alternatives ?? [])]) {
      expect(candidate?.name).toBeTruthy();
      expect(candidate?.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(knownHexByName[candidate?.name ?? ""]).toBe(candidate?.hex);
      expect(candidate?.buy_url_kind).toMatch(/pdd_goods|pdd_search/);
    }
    expect(new Set([slot?.best?.buy_url_kind, ...(slot?.alternatives ?? []).map((candidate) => candidate.buy_url_kind)])).toEqual(new Set(["pdd_goods", "pdd_search"]));
  });
});
