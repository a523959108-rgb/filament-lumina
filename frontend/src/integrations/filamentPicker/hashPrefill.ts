import type { SavedMaterialLibraryItem } from "../../api/types";

export type StackPrefillLutEntry = {
  name: string;
  color_mode?: string;
  path?: string;
};

export type StackPrefillMode = "RYBW" | "CMYW";

export interface StackHashPrefill {
  isStackRoute: boolean;
  colors: string[];
  mode: StackPrefillMode | null;
}

const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;
const MAX_PREFILL_COLORS = 8;

const PREFERRED_LEGACY_LUTS: Record<StackPrefillMode, readonly string[]> = {
  RYBW: ["bambulab - bambulab_pla_basic_rybw"],
  CMYW: ["bambulab - bambulab_pla_basic_cmyw", "bambulab - bambulab_pla_basic_cmyw_new"],
};

export function normalizePrefillHex(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  return `#${trimmed.replace(/^#/, "").toUpperCase()}`;
}

export function parseStackHashPrefill(hash: string): StackHashPrefill {
  const trimmed = hash.trim();
  const body = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const qIndex = body.indexOf("?");
  const routePath = (qIndex === -1 ? body : body.slice(0, qIndex)).replace(/\/+$/, "");
  const isStackRoute = routePath === "/stack";
  if (!isStackRoute) {
    return { isStackRoute: false, colors: [], mode: null };
  }

  const params = new URLSearchParams(qIndex === -1 ? "" : body.slice(qIndex + 1));
  const rawColors = params.get("colors") ?? "";
  const colors: string[] = [];
  for (const token of rawColors.split(",")) {
    const hex = normalizePrefillHex(token);
    if (hex === null || colors.includes(hex)) continue;
    colors.push(hex);
    if (colors.length >= MAX_PREFILL_COLORS) break;
  }

  const rawMode = (params.get("mode") ?? "").trim().toUpperCase();
  const mode: StackPrefillMode | null =
    rawMode === "RYBW" || rawMode === "CMYW" ? rawMode : null;

  return { isStackRoute: true, colors, mode };
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const normalized = hex.replace(/^#/, "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function redmeanDistanceSq(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const rMean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}

function clampRgbTriplet(rgb: readonly number[] | undefined): [number, number, number] | null {
  if (!Array.isArray(rgb) || rgb.length < 3) return null;
  const [r, g, b] = rgb;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

/**
 * Pick distinct material archives nearest to each incoming target hex.
 * When only one color is requested, append a white backing material if needed
 * so multi-color stacking has at least two filaments ready.
 */
export function matchMaterialsForPrefillColors(
  targetHexes: readonly string[],
  materials: readonly SavedMaterialLibraryItem[],
): string[] {
  const candidates = materials
    .map((item) => ({
      item,
      rgb: clampRgbTriplet(item.estimated_rgb),
    }))
    .filter((entry): entry is { item: SavedMaterialLibraryItem; rgb: [number, number, number] } => entry.rgb !== null);

  if (targetHexes.length === 0 || candidates.length === 0) return [];

  const chosen: string[] = [];
  const used = new Set<string>();

  for (const hex of targetHexes) {
    const targetRgb = hexToRgbTuple(hex);
    let bestDir: string | null = null;
    let bestDist = Infinity;
    for (const candidate of candidates) {
      if (used.has(candidate.item.directory_name)) continue;
      const dist = redmeanDistanceSq(targetRgb, candidate.rgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = candidate.item.directory_name;
      }
    }
    if (bestDir !== null) {
      used.add(bestDir);
      chosen.push(bestDir);
    }
  }

  // Single-color links from swatch cards still need a backing filament for stacking.
  if (chosen.length === 1 && candidates.length >= 2) {
    const whiteTarget: [number, number, number] = [255, 255, 255];
    let bestWhite: string | null = null;
    let bestDist = Infinity;
    for (const candidate of candidates) {
      if (used.has(candidate.item.directory_name)) continue;
      const dist = redmeanDistanceSq(whiteTarget, candidate.rgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestWhite = candidate.item.directory_name;
      }
    }
    if (bestWhite !== null) {
      chosen.push(bestWhite);
    }
  }

  return chosen;
}

export function findLegacyLutForMode<T extends StackPrefillLutEntry>(
  mode: StackPrefillMode,
  luts: readonly T[],
): T | null {
  if (luts.length === 0) return null;
  const preferred = PREFERRED_LEGACY_LUTS[mode];
  for (const name of preferred) {
    const exact = luts.find((lut) => lut.name === name);
    if (exact) return exact;
  }
  const needle = mode.toUpperCase();
  return (
    luts.find((lut) => {
      const colorMode = (lut.color_mode ?? "").toUpperCase();
      return colorMode.includes("4-COLOR") && colorMode.includes(needle);
    }) ??
    luts.find((lut) => (lut.color_mode ?? "").toUpperCase().includes(needle)) ??
    null
  );
}
