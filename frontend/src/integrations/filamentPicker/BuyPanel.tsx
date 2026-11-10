import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useConverterStore } from "../../stores/converter";
import { useI18n } from "../../i18n/context";
import { isBuyMockEnabled, isBuyPanelEnabled, resolveBuyApiUrl } from "./buyConfig";
import { createMockMatch } from "./mockMatch";
import { fetchMatch } from "./matchApi";
import type { MatchCandidate, MatchChannel, MatchRequest, MatchResponse } from "./types";

const MAX_CHANNELS = 8;
const matchCache = new Map<string, Promise<MatchResponse>>();

const copy = {
  zh: {
    title: "这几卷去哪买",
    loading: "正在查找匹配耗材…",
    error: "购买推荐暂不可用",
    empty: "预览完成后才能匹配耗材。",
    noMatch: "暂未找到匹配耗材",
    alternatives: "备选",
    legend: "左：LUT 通道色 → 右：推荐耗材",
    inputSwatch: "LUT 通道色",
    recommendedSwatch: "推荐耗材色",
    alternativeSwatch: "备选耗材色",
    buy: "去拼多多",
    search: "拼多多搜索",
    other: "查看购买链接",
    close: "收起",
    similar: "很接近",
    closeEnough: "接近",
    different: "有差异",
    source: "数据来自 耗材选色站 filament.ibaozi.com",
  },
  en: {
    title: "Where to buy these rolls",
    loading: "Finding matching filaments…",
    error: "Filament recommendations are unavailable",
    empty: "Generate a preview to match filaments.",
    noMatch: "No matching filament found",
    alternatives: "Alternatives",
    legend: "Left: LUT channel color → right: recommended filament",
    inputSwatch: "LUT channel color",
    recommendedSwatch: "Recommended filament color",
    alternativeSwatch: "Alternative filament color",
    buy: "Buy on Pinduoduo",
    search: "Pinduoduo search",
    other: "View purchase link",
    close: "Collapse",
    similar: "Very close",
    closeEnough: "Close",
    different: "Different",
    source: "Data from filament-picker filament.ibaozi.com",
  },
} as const;

type LutPaletteEntry = {
  color?: string;
  color_mode?: string;
  material?: string;
  hex_color?: string | null;
  color_name?: string | null;
};

function normalizeHex(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(compact) ? `#${compact.toUpperCase()}` : undefined;
}

function inferPalette(colorMode: string | null | undefined, lutName: string): "RYBW" | "CMYW" | null {
  const value = `${colorMode ?? ""} ${lutName}`.toUpperCase();
  if (value.includes("CMYW")) return "CMYW";
  if (value.includes("RYBW")) return "RYBW";
  return null;
}

export interface BuildBuyChannelsInput {
  selectedLutInfo?: { palette?: LutPaletteEntry[]; color_mode?: string } | null;
  lutColors?: Array<{ hex?: string }>;
  palette?: Array<{ matched_hex?: string; quantized_hex?: string }>;
  selectedNativeDbNames?: string[];
  colorMode?: string | null;
  lutName?: string;
}

/** Resolve channels from the same post-preview metadata used by Lumina's editor. */
// eslint-disable-next-line react-refresh/only-export-components
export function buildBuyChannels(input: BuildBuyChannelsInput): {
  channels: MatchChannel[];
  palette: "RYBW" | "CMYW" | null;
  material: string | null;
} {
  const inferredPalette = inferPalette(input.colorMode ?? input.selectedLutInfo?.color_mode, input.lutName ?? "");
  const infoPalette = input.selectedLutInfo?.palette ?? [];
  const nativeNames = input.selectedNativeDbNames ?? [];
  const lutColors = input.lutColors ?? [];
  const previewPalette = input.palette ?? [];
  const material = infoPalette.find((entry) => entry.material?.trim())?.material?.trim() ?? null;
  // Lumina's LUT channel order (e.g. W,R,Y,B) differs from the tray map
  // order (R,Y,B,W); never invent positional labels. The bridge assigns
  // channels to tray slots by label (when Lumina provides colour names) or
  // by minimum ΔE.
  let channels: MatchChannel[] = infoPalette.slice(0, MAX_CHANNELS).map((entry) => {
    const nameParts = [entry.material, entry.color_name || entry.color].filter((value): value is string => Boolean(value?.trim()));
    const hex = normalizeHex(entry.hex_color);
    const label = entry.color?.trim();
    return {
      ...(label ? { label } : {}),
      ...(hex ? { hex } : {}),
      ...(nameParts.length > 0 ? { name: nameParts.join(" ") } : {}),
    };
  });

  if (channels.length === 0 && nativeNames.length > 0) {
    channels = nativeNames.slice(0, MAX_CHANNELS).map((name) => ({
      ...(name.trim() ? { name: name.trim() } : {}),
    }));
  }
  // ``lutColors`` is normally the full LUT catalog; only use it as a channel
  // fallback when it is already a small slot-sized list.
  if (channels.length === 0 && lutColors.length > 0 && lutColors.length <= MAX_CHANNELS) {
    channels = lutColors.slice(0, MAX_CHANNELS).map((entry) => ({
      ...(normalizeHex(entry.hex) ? { hex: normalizeHex(entry.hex) } : {}),
    }));
  }
  if (channels.length === 0 && previewPalette.length > 0) {
    channels = previewPalette.slice(0, MAX_CHANNELS).map((entry) => ({
      ...(normalizeHex(entry.matched_hex ?? entry.quantized_hex) ? { hex: normalizeHex(entry.matched_hex ?? entry.quantized_hex) } : {}),
    }));
  }
  return { channels: channels.filter((channel) => channel.hex || channel.name), palette: inferredPalette, material };
}

type DeltaTone = "very-close" | "close" | "different" | "unknown";

function deltaLabel(value: number | null, language: keyof typeof copy): { text: string; tone: DeltaTone } {
  if (value === null) return { text: "ΔE —", tone: "unknown" };
  const text = value.toFixed(2);
  const labels = copy[language];
  if (value < 2) return { text: `ΔE ≈${text} · ${labels.similar}`, tone: "very-close" };
  if (value < 5) return { text: `ΔE ≈${text} · ${labels.closeEnough}`, tone: "close" };
  return { text: `ΔE ≈${text} · ${labels.different}`, tone: "different" };
}

function candidateCode(candidate: MatchCandidate): string | null {
  const code = candidate.catalog_id.split("/").at(-1)?.match(/\d{4,}$/)?.[0];
  return code ?? candidate.series;
}

function candidateBrandSeries(candidate: MatchCandidate): string {
  return [candidate.brand, candidate.series].filter(Boolean).join(" · ");
}

function deltaToneClass(tone: DeltaTone): string {
  if (tone === "very-close") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "close") return "text-blue-600 dark:text-blue-400";
  if (tone === "different") return "text-orange-600 dark:text-orange-400";
  return "text-slate-500 dark:text-slate-400";
}

function buyLabelFor(candidate: MatchCandidate, labels: typeof copy[keyof typeof copy]): string {
  return candidate.buy_url_kind === "pdd_goods" ? labels.buy : candidate.buy_url_kind === "pdd_search" ? labels.search : labels.other;
}

function requestKey(request: MatchRequest): string {
  return JSON.stringify(request);
}

function getOrCreateMatch(request: MatchRequest, mockEnabled: boolean, cacheScope: string): Promise<MatchResponse> {
  const key = `${mockEnabled ? "mock" : "api"}:${cacheScope}:${requestKey(request)}`;
  const cached = matchCache.get(key);
  if (cached) return cached;
  const promise = mockEnabled
    ? Promise.resolve(createMockMatch(request))
    : fetchMatch(request, { apiUrl: resolveBuyApiUrl() });
  matchCache.set(key, promise);
  void promise.catch(() => {
    if (matchCache.get(key) === promise) matchCache.delete(key);
  });
  return promise;
}

// eslint-disable-next-line react-refresh/only-export-components
export function clearBuyMatchCache(): void {
  matchCache.clear();
}

function Swatch({ color, label }: { color: string | null; label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      role="img"
      className="inline-block h-5 w-5 shrink-0 rounded-full border-2 border-slate-500/90 ring-1 ring-inset ring-slate-500/70 dark:border-slate-300/90 dark:ring-slate-300/70"
      style={{ backgroundColor: color ?? "transparent" }}
    />
  );
}

function SlotRow({ slot, language }: { slot: MatchResponse["slots"][number]; language: keyof typeof copy }) {
  const labels = copy[language];
  const [open, setOpen] = useState(false);
  const candidate = slot.best;
  const buyLabel = candidate ? buyLabelFor(candidate, labels) : labels.other;
  return (
    <article className="min-w-0 rounded-xl bg-[var(--surface-well)] px-2.5 py-2.5" data-testid={`buy-slot-${slot.index}`}>
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <Swatch color={slot.input_hex} label={labels.inputSwatch} />
          <span className="text-slate-400" aria-hidden="true">↔</span>
          <Swatch color={candidate?.hex ?? null} label={labels.recommendedSwatch} />
        </div>
        <div className="min-w-0 flex-1">
          {candidate ? (
            <>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1">
                <span className="min-w-0 break-words text-xs font-semibold leading-4 text-slate-800 dark:text-slate-100">{candidate.name || labels.noMatch}</span>
                {candidateCode(candidate) && <span className="shrink-0 truncate text-[10px] text-slate-500 dark:text-slate-400">{candidateCode(candidate)}</span>}
              </div>
              <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">{candidateBrandSeries(candidate)}</div>
              <div className={`text-[11px] leading-4 ${deltaToneClass(deltaLabel(candidate.delta_e, language).tone)}`}>
                {deltaLabel(candidate.delta_e, language).text}
              </div>
            </>
          ) : (
            <div className="break-words text-xs font-semibold leading-4 text-slate-800 dark:text-slate-100">{slot.input_name || slot.label || labels.noMatch}</div>
          )}
          {slot.note && <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">{slot.note}</div>}
        </div>
      </div>
      {candidate && (
        <div className="mt-1.5 flex justify-end">
          <a
            className="action-control inline-flex min-h-7 shrink-0 items-center rounded-lg px-2 py-1 text-[11px] font-medium"
            href={candidate.buy_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`buy-link-${slot.index}`}
          >
            {buyLabel}
          </a>
        </div>
      )}
      {slot.alternatives.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button"
            className="ghost-control text-[11px] text-slate-500 dark:text-slate-400"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? labels.close : labels.alternatives} ({slot.alternatives.length})
          </button>
          {open && (
            <ul className="mt-1.5 flex flex-col gap-1.5" data-testid={`buy-alternatives-${slot.index}`}>
              {slot.alternatives.map((alternative) => (
                <li key={alternative.catalog_id || `${alternative.name}-${alternative.hex}`} className="flex min-w-0 items-center gap-1.5 text-[11px]">
                  <Swatch color={alternative.hex} label={labels.alternativeSwatch} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium leading-4 text-slate-600 dark:text-slate-300">{alternative.name || labels.noMatch}</span>
                    <span className="block truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400">{candidateBrandSeries(alternative)}</span>
                    <span className={`block text-[10px] leading-4 ${deltaToneClass(deltaLabel(alternative.delta_e, language).tone)}`}>
                      {deltaLabel(alternative.delta_e, language).text}
                    </span>
                  </span>
                  <a href={alternative.buy_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-blue-600 hover:underline dark:text-blue-400">{buyLabelFor(alternative, labels)}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function LoadingState({ language }: { language: keyof typeof copy }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" data-testid="buy-panel-loading">
      {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-[var(--surface-well)]" />)}
      <span className="sr-only">{copy[language].loading}</span>
    </div>
  );
}

export function BuyPanel() {
  const { lang } = useI18n();
  const language = lang === "en" ? "en" : "zh";
  const state = useConverterStore(useShallow((current) => ({
    sessionId: current.sessionId,
    previewImageUrl: current.previewImageUrl,
    previewBaseImageUrl: current.previewBaseImageUrl,
    previewGlbUrl: current.previewGlbUrl,
    isLoading: current.isLoading,
    selectedLutInfo: current.selectedLutInfo,
    lutColors: current.lutColors,
    palette: current.palette,
    selectedNativeDbNames: current.selectedNativeDbNames,
    colorMode: current.color_mode,
    lutName: current.lut_name,
    selectedNativeBrandKey: current.selectedNativeBrandKey,
  })));
  const enabled = isBuyPanelEnabled();
  const previewReady = Boolean(state.sessionId && (state.previewImageUrl || state.previewBaseImageUrl || state.previewGlbUrl) && !state.isLoading);
  const channelData = useMemo(() => buildBuyChannels({
    selectedLutInfo: state.selectedLutInfo,
    lutColors: state.lutColors,
    palette: state.palette,
    selectedNativeDbNames: state.selectedNativeDbNames,
    colorMode: state.colorMode || state.selectedLutInfo?.color_mode,
    lutName: state.lutName,
  }), [state.colorMode, state.lutName, state.lutColors, state.palette, state.selectedLutInfo, state.selectedNativeDbNames]);
  const request = useMemo<MatchRequest>(() => ({
    channels: channelData.channels,
    palette: channelData.palette,
    material: channelData.material,
    brand: state.selectedNativeBrandKey || null,
    max_alternatives: 3,
  }), [channelData, state.selectedNativeBrandKey]);
  const key = useMemo(() => requestKey(request), [request]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [response, setResponse] = useState<MatchResponse | null>(null);

  useEffect(() => {
    if (!enabled || !previewReady) {
      setStatus("idle");
      setResponse(null);
      return;
    }
    if (request.channels.length === 0) {
      setStatus("success");
      setResponse({ schema_version: 1, palette: request.palette ?? null, slots: [], disclaimer: "" });
      return;
    }
    let active = true;
    setStatus("loading");
    setResponse(null);
    void getOrCreateMatch(request, isBuyMockEnabled(), state.sessionId ?? "preview").then((result) => {
      if (!active) return;
      setResponse(result);
      setStatus("success");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [enabled, key, previewReady, request, state.sessionId]);

  if (!enabled) return null;
  if (!previewReady) return null;
  const labels = copy[language];
  return (
    <section className="mt-3 flex min-w-0 flex-col gap-2 border-t border-[color:var(--surface-divider)] pt-3" data-testid="buy-panel">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{labels.title}</h3>
      <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">{labels.legend}</p>
      {status === "loading" && <LoadingState language={language} />}
      {status === "error" && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{labels.error}</p>}
      {status === "success" && response && (
        response.slots.length > 0
          ? <div className="flex min-w-0 flex-col gap-2">{response.slots.map((slot) => <SlotRow key={`${slot.index}-${slot.label ?? ""}`} slot={slot} language={language} />)}</div>
          : <p className="rounded-xl bg-[var(--surface-well)] px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{labels.empty}</p>
      )}
      {status === "success" && response && (
        <>
          {response.disclaimer && <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">{response.disclaimer}</p>}
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{labels.source}</p>
        </>
      )}
    </section>
  );
}

export default BuyPanel;
