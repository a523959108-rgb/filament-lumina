import { describe, expect, it, vi } from "vitest";
import { buildMatchRequest, fetchMatch, parseMatchResponse } from "../matchApi";

describe("filament match API", () => {
  it("sends the contract request body and normalizes response colors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      schema_version: 1,
      palette: "RYBW",
      slots: [{ index: 0, input_hex: "e94a39", best: { hex: "de4343", buy_url: "https://pdd.test/1", buy_url_kind: "pdd_goods", source: "tray_map" } }],
      disclaimer: "请以实物为准",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const request = buildMatchRequest({ channels: [{ label: "R", hex: "e94a39" }], palette: "RYBW", material: "PLA", brand: "bambu-lab", max_alternatives: 3 });
    const result = await fetchMatch(request, { apiUrl: "https://example.test/match", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.test/match", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }));
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("credentials");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(request);
    expect(result.slots[0]?.input_hex).toBe("#E94A39");
    expect(result.slots[0]?.best?.hex).toBe("#DE4343");
  });

  it("degrades missing and malformed response fields safely", () => {
    expect(parseMatchResponse({ slots: [{ index: 4, best: { hex: "bad" } }, null] })).toMatchObject({ palette: null, slots: [{ index: 4, best: null }, { index: 1, best: null }] });
  });

  it("reports non-2xx responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("bad", { status: 422 }));
    await expect(fetchMatch({ channels: [{ name: "白" }] }, { fetchImpl })).rejects.toMatchObject({ kind: "http", status: 422 });
  });

  it("keeps the bridge validation detail shape for 422 responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      detail: [{ loc: ["body", "channels"], msg: "channels must contain 1 to 8 items", type: "value_error" }],
    }), { status: 422, headers: { "Content-Type": "application/json" } }));
    await expect(fetchMatch({ channels: [{ name: "白" }] }, { fetchImpl })).rejects.toMatchObject({
      kind: "http",
      detail: [{ loc: ["body", "channels"], type: "value_error" }],
    });
  });

  it("aborts a request at the timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }));
      const pending = fetchMatch({ channels: [{ hex: "#fff" }] }, { fetchImpl, timeoutMs: 50 });
      const handled = pending.then(
        () => { throw new Error("expected timeout"); },
        (error: unknown) => expect(error).toMatchObject({ kind: "timeout" }),
      );
      await vi.advanceTimersByTimeAsync(50);
      await handled;
    } finally {
      vi.useRealTimers();
    }
  });
});
