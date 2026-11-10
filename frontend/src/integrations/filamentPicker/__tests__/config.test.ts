import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILAMENT_PICKER_SITE_URL,
  DEFAULT_FILAMENT_PICKER_SOURCE_URL,
  getFilamentPickerConfig,
} from "../config";

describe("filament-picker integration config", () => {
  it("keeps the upstream-compatible defaults disabled", () => {
    const config = getFilamentPickerConfig({});

    expect(config.integrationEnabled).toBe(false);
    expect(config.hideLocalOnly).toBe(false);
    expect(config.siteUrl).toBe(DEFAULT_FILAMENT_PICKER_SITE_URL);
    expect(config.sourceUrl).toBe(DEFAULT_FILAMENT_PICKER_SOURCE_URL);
    expect(config.links).toHaveLength(5);
  });

  it("enables navigation and follows custom URLs", () => {
    const config = getFilamentPickerConfig({
      VITE_FP_INTEGRATION: "1",
      VITE_FP_SITE_URL: "https://picker.example.test",
      VITE_FP_SOURCE_URL: "https://github.com/example/lumina",
    });

    expect(config.integrationEnabled).toBe(true);
    expect(config.hideLocalOnly).toBe(true);
    expect(config.links.map((link) => link.href)).toEqual([
      "https://picker.example.test/",
      "https://picker.example.test/",
      "https://picker.example.test/#/plan",
      "https://picker.example.test/#/cost",
      "https://github.com/example/lumina",
    ]);
  });

  it("allows local-only controls to remain visible when explicitly requested", () => {
    expect(getFilamentPickerConfig({
      VITE_FP_INTEGRATION: "1",
      VITE_FP_HIDE_LOCAL_ONLY: "0",
    }).hideLocalOnly).toBe(false);
  });
});
