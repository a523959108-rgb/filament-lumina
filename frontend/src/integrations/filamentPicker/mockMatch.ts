import type { MatchCandidate, MatchChannel, MatchRequest, MatchResponse, MatchSource } from "./types";

type MockPalette = "RYBW" | "CMYW";

type MockCatalogItem = {
  catalogId: string;
  series: string;
  name: string;
  hex: string;
  code: string;
  buyUrlKind: "pdd_goods" | "pdd_search";
  trayKeys?: string[];
};

type LabColor = [number, number, number];

const PALETTE_LABELS: Record<MockPalette, string[]> = {
  RYBW: ["R", "Y", "B", "W"],
  CMYW: ["C", "M", "Y", "W"],
};

/** A small, deterministic directory assembled from the bridge's tray map/catalog. */
const MOCK_CATALOG: MockCatalogItem[] = [
  { catalogId: "bambu-lab/pla-matte/scarlet-red-11200", series: "PLA Matte", name: "猩红", hex: "#DE4343", code: "11200", buyUrlKind: "pdd_goods", trayKeys: ["RYBW:R"] },
  { catalogId: "bambu-lab/pla-basic/red-10200", series: "PLA Basic", name: "红色", hex: "#C12E1F", code: "10200", buyUrlKind: "pdd_search" },
  { catalogId: "bambu-lab/pla-basic/yellow-10400", series: "PLA Basic", name: "黄", hex: "#F4EE2A", code: "10400", buyUrlKind: "pdd_search", trayKeys: ["RYBW:Y", "CMYW:Y"] },
  { catalogId: "bambu-lab/pla-matte/lemon-yellow-11400", series: "PLA Matte", name: "柠檬黄", hex: "#F7D959", code: "11400", buyUrlKind: "pdd_goods" },
  { catalogId: "bambu-lab/pla-basic/cobalt-blue-10604", series: "PLA Basic", name: "钴蓝", hex: "#0056B8", code: "10604", buyUrlKind: "pdd_goods", trayKeys: ["RYBW:B"] },
  { catalogId: "bambu-lab/pla-basic/blue-10601", series: "PLA Basic", name: "蓝色", hex: "#0A2989", code: "10601", buyUrlKind: "pdd_search" },
  { catalogId: "bambu-lab/pla-basic/cyan-10603", series: "PLA Basic", name: "青", hex: "#0086D6", code: "10603", buyUrlKind: "pdd_goods", trayKeys: ["CMYW:C"] },
  { catalogId: "bambu-lab/pla-basic/magenta-10202", series: "PLA Basic", name: "品红", hex: "#EC008C", code: "10202", buyUrlKind: "pdd_search", trayKeys: ["CMYW:M"] },
  { catalogId: "bambu-lab/pla-basic/light-gray-10104", series: "PLA Basic", name: "浅灰", hex: "#D1D3D5", code: "10104", buyUrlKind: "pdd_search", trayKeys: ["RYBW:W"] },
  { catalogId: "bambu-lab/pla-basic/jade-white-10100", series: "PLA Basic", name: "玉石白", hex: "#FFFFFF", code: "10100", buyUrlKind: "pdd_goods", trayKeys: ["CMYW:W"] },
  { catalogId: "bambu-lab/pla-basic/black-10101", series: "PLA Basic", name: "黑色", hex: "#000000", code: "10101", buyUrlKind: "pdd_search" },
  { catalogId: "bambu-lab/pla-basic/orange-10300", series: "PLA Basic", name: "橙色", hex: "#FF6A13", code: "10300", buyUrlKind: "pdd_goods" },
  { catalogId: "bambu-lab/pla-basic/bambu-green-10501", series: "PLA Basic", name: "拓竹绿", hex: "#00AE42", code: "10501", buyUrlKind: "pdd_search" },
  { catalogId: "bambu-lab/pla-basic/pink-10203", series: "PLA Basic", name: "粉色", hex: "#F55A74", code: "10203", buyUrlKind: "pdd_goods" },
  { catalogId: "bambu-lab/pla-basic/purple-10700", series: "PLA Basic", name: "紫色", hex: "#5E43B7", code: "10700", buyUrlKind: "pdd_search" },
  { catalogId: "bambu-lab/pla-basic/brown-10800", series: "PLA Basic", name: "棕色", hex: "#9D432C", code: "10800", buyUrlKind: "pdd_goods" },
];

function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(compact) ? `#${compact.toUpperCase()}` : null;
}

function hexToLab(value: string): LabColor {
  const hex = value.slice(1);
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const [r, g, b] = rgb;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const pivot = (channel: number) => channel > 0.008856 ? channel ** (1 / 3) : 7.787 * channel + 16 / 116;
  const [fx, fy, fz] = [x, y, z].map(pivot);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function approximateDeltaE(input: string, candidate: string): number {
  const [l1, a1, b1] = hexToLab(input);
  const [l2, a2, b2] = hexToLab(candidate);
  return Number(Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2).toFixed(2));
}

function paletteFor(value: MatchRequest["palette"]): MockPalette | null {
  const normalized = typeof value === "string" ? value.toUpperCase() : value;
  return normalized === "RYBW" || normalized === "CMYW" ? normalized : null;
}

function targetHexFor(channel: MatchChannel, index: number, request: MatchRequest): string | null {
  const inputHex = normalizeHex(channel.hex);
  if (inputHex) return inputHex;
  const palette = paletteFor(request.palette);
  const label = channel.label?.trim() || (palette ? PALETTE_LABELS[palette][index] : undefined);
  if (palette && label) {
    const trayItem = MOCK_CATALOG.find((item) => item.trayKeys?.includes(`${palette}:${label}`));
    if (trayItem) return trayItem.hex;
  }
  const name = channel.name?.trim();
  if (name) {
    const namedItem = MOCK_CATALOG.find((item) => item.name === name || name.includes(item.name));
    if (namedItem) return namedItem.hex;
  }
  return null;
}

function isTrayMatch(item: MockCatalogItem, channel: MatchChannel, index: number, request: MatchRequest): boolean {
  const palette = paletteFor(request.palette);
  if (!palette || request.channels.length !== 4) return false;
  const label = channel.label?.trim() || PALETTE_LABELS[palette][index];
  return Boolean(label && item.trayKeys?.includes(`${palette}:${label}`));
}

function candidateSource(item: MockCatalogItem, channel: MatchChannel, index: number, request: MatchRequest): MatchSource {
  if (!normalizeHex(channel.hex)) return "name";
  return isTrayMatch(item, channel, index, request) ? "tray_map" : "nearest";
}

function buyUrlFor(item: MockCatalogItem): string {
  if (item.buyUrlKind === "pdd_goods") {
    return `https://mobile.yangkeduo.com/goods.html?goods_id=mock-${item.code}`;
  }
  return `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(`Bambu Lab ${item.series} ${item.name}`)}`;
}

function toCandidate(
  item: MockCatalogItem,
  channel: MatchChannel,
  index: number,
  request: MatchRequest,
  targetHex: string | null,
): MatchCandidate {
  return {
    catalog_id: item.catalogId,
    brand: "Bambu Lab",
    brand_slug: "bambu-lab",
    series: item.series,
    name: item.name,
    hex: item.hex,
    delta_e: targetHex && normalizeHex(channel.hex) ? approximateDeltaE(targetHex, item.hex) : null,
    buy_url: buyUrlFor(item),
    buy_url_kind: item.buyUrlKind,
    other_urls: [],
    price_text: "示例价格",
    source: candidateSource(item, channel, index, request),
  };
}

export function createMockMatch(request: MatchRequest): MatchResponse {
  const palette = paletteFor(request.palette);
  const alternativeLimit = Math.min(Math.max(request.max_alternatives ?? 2, 0), 2);
  return {
    schema_version: 1,
    palette,
    slots: request.channels.map((channel, index) => {
      const targetHex = targetHexFor(channel, index, request);
      const ranked = [...MOCK_CATALOG].sort((left, right) => {
        if (!targetHex) {
          const leftTray = isTrayMatch(left, channel, index, request) ? 0 : 1;
          const rightTray = isTrayMatch(right, channel, index, request) ? 0 : 1;
          return leftTray - rightTray;
        }
        return approximateDeltaE(targetHex, left.hex) - approximateDeltaE(targetHex, right.hex);
      });
      const bestItem = ranked[0];
      const alternatives = ranked.slice(1, alternativeLimit + 1);
      return {
        index,
        label: channel.label ?? null,
        input_hex: normalizeHex(channel.hex),
        input_name: channel.name ?? null,
        best: bestItem ? toCandidate(bestItem, channel, index, request, targetHex) : null,
        alternatives: alternatives.map((item) => toCandidate(item, channel, index, request, targetHex)),
        note: null,
      };
    }),
    disclaimer: "示例数据仅用于预览；颜色为屏幕近似，购买前请以商品页实物色为准。",
  };
}

export const mockMatch = createMockMatch;
