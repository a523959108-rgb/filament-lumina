import { describe, expect, it } from "vitest";
import type { SavedMaterialLibraryItem } from "../../../api/types";
import {
  findLegacyLutForMode,
  matchMaterialsForPrefillColors,
  parseStackHashPrefill,
  type StackPrefillLutEntry,
} from "../hashPrefill";

function makeMaterial(
  directoryName: string,
  rgb: [number, number, number],
): SavedMaterialLibraryItem {
  return {
    material_name: directoryName.split("/").at(-1) ?? directoryName,
    directory_name: directoryName,
    created_at: "2026-11-18T00:00:00Z",
    updated_at: "2026-11-18T00:00:00Z",
    material_file_url: null,
    estimated_rgb: rgb,
    layer_height_mm: 0.08,
    mean_delta_e: null,
    verification_count: 0,
    verification_history: [],
  };
}

describe("parseStackHashPrefill", () => {
  it("parses #/stack with colors and mode", () => {
    expect(
      parseStackHashPrefill("#/stack?colors=e94a39,ECEF35,bad,e94a39&mode=cmyw"),
    ).toEqual({
      isStackRoute: true,
      colors: ["#E94A39", "#ECEF35"],
      mode: "CMYW",
    });
  });

  it("recognizes bare #/stack and ignores unrelated hashes", () => {
    expect(parseStackHashPrefill("#/stack")).toEqual({
      isStackRoute: true,
      colors: [],
      mode: null,
    });
    expect(parseStackHashPrefill("#/other?colors=FFFFFF")).toEqual({
      isStackRoute: false,
      colors: [],
      mode: null,
    });
  });
});

describe("matchMaterialsForPrefillColors", () => {
  const materials = [
    makeMaterial("Bambu Lab/Red", [222, 67, 67]),
    makeMaterial("Bambu Lab/Green", [0, 174, 66]),
    makeMaterial("Bambu Lab/Yellow", [244, 238, 42]),
    makeMaterial("Bambu Lab/Jade White", [255, 255, 255]),
  ];

  it("matches each target color to distinct nearest material archives", () => {
    expect(
      matchMaterialsForPrefillColors(["#DE4343", "#00AE42"], materials),
    ).toEqual(["Bambu Lab/Red", "Bambu Lab/Green"]);
  });

  it("appends a white backing material when only one swatch color is supplied", () => {
    expect(matchMaterialsForPrefillColors(["#DE4343"], materials)).toEqual([
      "Bambu Lab/Red",
      "Bambu Lab/Jade White",
    ]);
  });
});

describe("findLegacyLutForMode", () => {
  const luts: StackPrefillLutEntry[] = [
    { name: "Aliz - RYBW", color_mode: "4-Color (RYBW)", path: "Aliz/rybw.npy" },
    {
      name: "bambulab - bambulab_pla_basic_rybw",
      color_mode: "4-Color (RYBW)",
      path: "bambulab/rybw.npy",
    },
    {
      name: "bambulab - bambulab_pla_basic_cmyw",
      color_mode: "4-Color (CMYW)",
      path: "bambulab/cmyw.npy",
    },
  ];

  it("prefers the classic Bambu Lab RYBW/CMYW LUT when present", () => {
    expect(findLegacyLutForMode("RYBW", luts)?.name).toBe(
      "bambulab - bambulab_pla_basic_rybw",
    );
    expect(findLegacyLutForMode("CMYW", luts)?.name).toBe(
      "bambulab - bambulab_pla_basic_cmyw",
    );
  });
});
