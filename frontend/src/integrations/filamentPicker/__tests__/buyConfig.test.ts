import { describe, expect, it } from "vitest";
import { DEFAULT_BUY_API_URL, isBuyMockEnabled, isBuyPanelEnabled, resolveBuyConfig, resolveBuyApiUrl } from "../buyConfig";

describe("buy panel config", () => {
  it("keeps the upstream-safe defaults", () => {
    expect(resolveBuyConfig({})).toEqual({ apiUrl: DEFAULT_BUY_API_URL, panelEnabled: false, mockEnabled: false });
  });

  it("reads the three Vite flags without coupling to import.meta.env", () => {
    const env = { VITE_FP_BUY_API_URL: " https://example.test/match ", VITE_FP_BUY_PANEL: "1", VITE_FP_BUY_MOCK: "1" };
    expect(resolveBuyApiUrl(env)).toBe("https://example.test/match");
    expect(isBuyPanelEnabled(env)).toBe(true);
    expect(isBuyMockEnabled(env)).toBe(true);
    expect(resolveBuyConfig(env)).toEqual({ apiUrl: "https://example.test/match", panelEnabled: true, mockEnabled: true });
  });
});
