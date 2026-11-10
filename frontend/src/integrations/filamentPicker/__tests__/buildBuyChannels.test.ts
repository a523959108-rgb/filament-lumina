import { describe, expect, it } from "vitest";
import { buildBuyChannels } from "../BuyPanel";

describe("buildBuyChannels", () => {
  it("keeps Lumina channel order and never invents positional RYBW labels", () => {
    const result = buildBuyChannels({
      lutName: "bambulab - bambulab_pla_basic_rybw",
      palette: [
        { matched_hex: "#ffffff" },
        { matched_hex: "#e94a39" },
        { matched_hex: "#ecef35" },
        { matched_hex: "#1f4ea3" },
      ],
    });
    expect(result.palette).toBe("RYBW");
    expect(result.channels.map((channel) => channel.hex)).toEqual(["#FFFFFF", "#E94A39", "#ECEF35", "#1F4EA3"]);
    expect(result.channels.every((channel) => channel.label === undefined)).toBe(true);
  });

  it("uses Lumina palette colour names as labels when present", () => {
    const result = buildBuyChannels({
      lutName: "bambulab_pla_basic_rybw",
      selectedLutInfo: { palette: [{ color: "White", hex_color: "#FFFFFF" }, { color: "Red", hex_color: "#E94A39" }] },
    });
    expect(result.channels.map((channel) => channel.label)).toEqual(["White", "Red"]);
  });
});
