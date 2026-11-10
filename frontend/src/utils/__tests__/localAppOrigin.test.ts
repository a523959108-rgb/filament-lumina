import { describe, expect, it } from "vitest";
import {
  isLocalLuminaAppOrigin,
  isLocalOnlyApiPath,
  normalizeApiPath,
} from "../localAppOrigin";

describe("isLocalLuminaAppOrigin", () => {
  it("accepts loopback hosts", () => {
    expect(isLocalLuminaAppOrigin("localhost")).toBe(true);
    expect(isLocalLuminaAppOrigin("127.0.0.1")).toBe(true);
    expect(isLocalLuminaAppOrigin("::1")).toBe(true);
    expect(isLocalLuminaAppOrigin("[::1]")).toBe(true);
  });

  it("rejects public and LAN hosts", () => {
    expect(isLocalLuminaAppOrigin("stack.filament.ibaozi.com")).toBe(false);
    expect(isLocalLuminaAppOrigin("100.90.12.104")).toBe(false);
    expect(isLocalLuminaAppOrigin("192.168.3.10")).toBe(false);
  });
});

describe("normalizeApiPath and isLocalOnlyApiPath", () => {
  it("normalizes relative, /api, and absolute URLs", () => {
    expect(normalizeApiPath("/system/settings")).toBe("/system/settings");
    expect(normalizeApiPath("/api/system/settings")).toBe("/system/settings");
    expect(normalizeApiPath("system/settings", "/api")).toBe("/system/settings");
    expect(
      normalizeApiPath(
        "https://stack.filament.ibaozi.com/api/slicer/detect",
      ),
    ).toBe("/slicer/detect");
  });

  it("flags local-only endpoints and leaves public ones alone", () => {
    expect(isLocalOnlyApiPath("/system/settings")).toBe(true);
    expect(isLocalOnlyApiPath("/api/slicer/detect")).toBe(true);
    expect(isLocalOnlyApiPath("/extractor/gradient-card-materials")).toBe(true);
    expect(
      isLocalOnlyApiPath(
        "/system/machine-registry/bed-model?device_profile_id=x",
      ),
    ).toBe(true);
    expect(isLocalOnlyApiPath("/system/printers")).toBe(false);
    expect(isLocalOnlyApiPath("/system/slicers")).toBe(false);
    expect(isLocalOnlyApiPath("/health")).toBe(false);
    expect(isLocalOnlyApiPath("/lut/catalog")).toBe(false);
    expect(isLocalOnlyApiPath("/convert/preview")).toBe(false);
  });
});
