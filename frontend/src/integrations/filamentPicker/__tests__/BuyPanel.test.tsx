import { describe, expect, afterEach, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BuyPanel, { clearBuyMatchCache } from "../BuyPanel";
import { useConverterStore } from "../../../stores/converter";

function setPreview() {
  useConverterStore.setState({
    sessionId: "session-buy-panel",
    previewImageUrl: "/api/preview.png",
    previewBaseImageUrl: "/api/preview.png",
    previewGlbUrl: null,
    isLoading: false,
    selectedLutInfo: { name: "RYBW", color_mode: "4-Color (RYBW)", color_count: 4, palette: [
      { color: "R", material: "PLA", hex_color: "#e94a39", color_name: "红" },
      { color: "Y", material: "PLA", hex_color: "#ecef35", color_name: "黄" },
    ] },
    lutColors: [],
    palette: [],
    selectedNativeDbNames: [],
    color_mode: "4-Color (RYBW)" as never,
    lut_name: "RYBW",
    selectedNativeBrandKey: "",
  });
}

describe("BuyPanel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearBuyMatchCache();
  });

  it("stays hidden by default and renders loading then successful mock recommendations", async () => {
    setPreview();
    const { rerender } = render(<BuyPanel />);
    expect(screen.queryByTestId("buy-panel")).not.toBeInTheDocument();
    vi.stubEnv("VITE_FP_BUY_PANEL", "1");
    vi.stubEnv("VITE_FP_BUY_MOCK", "1");
    rerender(<BuyPanel />);
    expect(screen.getByTestId("buy-panel-loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("这几卷去哪买")).toBeInTheDocument());
    expect(screen.getAllByText(/Bambu Lab.*PLA Basic/).length).toBeGreaterThan(0);
  });

  it("shows a network error and expands alternatives with safe purchase links", async () => {
    setPreview();
    vi.stubEnv("VITE_FP_BUY_PANEL", "1");
    vi.stubEnv("VITE_FP_BUY_MOCK", "1");
    render(<BuyPanel />);
    const slot = await screen.findByTestId("buy-slot-0");
    const alternatives = within(slot).getByRole("button", { name: /备选/ });
    fireEvent.click(alternatives);
    expect(screen.getByTestId("buy-alternatives-0")).toBeInTheDocument();
    expect(screen.getByTestId("buy-link-0")).toHaveAttribute("target", "_blank");
    expect(screen.getByTestId("buy-link-0")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the common unavailable state when the API fails", async () => {
    setPreview();
    vi.stubEnv("VITE_FP_BUY_PANEL", "1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<BuyPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("购买推荐暂不可用"));
  });
});
