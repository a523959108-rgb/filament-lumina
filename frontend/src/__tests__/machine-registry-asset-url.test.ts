import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../api/client";
import { getMachineRegistryAssetUrl } from "../api/system";
import * as systemApiModule from "../api/system";

const { isLocalLuminaAppOriginMock } = vi.hoisted(() => ({
  isLocalLuminaAppOriginMock: vi.fn(() => true),
}));

vi.mock("../utils/localAppOrigin", async () => {
  const actual = await vi.importActual<typeof import("../utils/localAppOrigin")>(
    "../utils/localAppOrigin",
  );
  return {
    ...actual,
    isLocalLuminaAppOrigin: isLocalLuminaAppOriginMock,
  };
});

const originalBaseUrl = apiClient.defaults.baseURL;

describe("machine registry asset URL", () => {
  beforeEach(() => {
    isLocalLuminaAppOriginMock.mockReturnValue(true);
  });

  afterEach(() => {
    apiClient.defaults.baseURL = originalBaseUrl;
  });

  it("uses a relative API asset path with the default API base", () => {
    apiClient.defaults.baseURL = "/api";

    expect(
      getMachineRegistryAssetUrl(
        "slicers/BambuStudio/02.07.01.57/assets/bambu-lab-h2d_cover.png",
      ),
    ).toBe(
      "/api/system/machine-registry/assets/slicers/BambuStudio/02.07.01.57/assets/bambu-lab-h2d_cover.png",
    );
  });

  it("uses the configured absolute API base for image assets", () => {
    apiClient.defaults.baseURL = "http://127.0.0.1:8001/api";

    expect(
      getMachineRegistryAssetUrl(
        "slicers/BambuStudio/02.07.01.57/assets/bambu-lab-h2d_cover.png",
      ),
    ).toBe(
      "http://127.0.0.1:8001/api/system/machine-registry/assets/slicers/BambuStudio/02.07.01.57/assets/bambu-lab-h2d_cover.png",
    );
  });

  it("builds a safe URL for the selected device's native slicer bed model", () => {
    apiClient.defaults.baseURL = "/api";
    const getMachineBedModelUrl = (
      systemApiModule as unknown as {
        getMachineBedModelUrl?: (deviceProfileId: string) => string;
      }
    ).getMachineBedModelUrl;

    expect(getMachineBedModelUrl).toBeTypeOf("function");
    if (!getMachineBedModelUrl) return;

    expect(
      getMachineBedModelUrl("OrcaSlicer:bbl:bambu-lab-a1-mini:0.4"),
    ).toBe(
      "/api/system/machine-registry/bed-model?device_profile_id=" +
        "OrcaSlicer%3Abbl%3Abambu-lab-a1-mini%3A0.4",
    );
  });

  it("does not request the native bed model on a public origin", () => {
    isLocalLuminaAppOriginMock.mockReturnValue(false);
    apiClient.defaults.baseURL = "/api";
    const getMachineBedModelUrl = (
      systemApiModule as unknown as {
        getMachineBedModelUrl?: (deviceProfileId: string) => string;
      }
    ).getMachineBedModelUrl;
    expect(getMachineBedModelUrl).toBeTypeOf("function");
    if (!getMachineBedModelUrl) return;
    expect(
      getMachineBedModelUrl("OrcaSlicer:bbl:bambu-lab-a1-mini:0.4"),
    ).toBe("");
  });
});
