import type {
  BuyUrlKind,
  MatchCandidate,
  MatchChannel,
  MatchRequest,
  MatchResponse,
  MatchSlot,
  MatchSource,
  MatchValidationIssue,
} from "./types";
import { resolveBuyApiUrl } from "./buyConfig";

export const MATCH_TIMEOUT_MS = 8_000;
const DEFAULT_DISCLAIMER = "颜色为屏幕近似，购买前请以商品页实物色为准。";

export interface MatchApiOptions {
  apiUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export class MatchApiError extends Error {
  readonly kind: "http" | "network" | "timeout";
  readonly status: number | null;
  readonly detail: MatchValidationIssue[] | null;

  constructor(
    kind: MatchApiError["kind"],
    message: string,
    status: number | null = null,
    detail: MatchValidationIssue[] | null = null,
  ) {
    super(message);
    this.name = "MatchApiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(compact) ? `#${compact.toUpperCase()}` : null;
}

function normalizeChannel(channel: unknown): MatchChannel {
  if (!channel || typeof channel !== "object") return {};
  const source = channel as Record<string, unknown>;
  const label = typeof source.label === "string" ? source.label : undefined;
  const name = typeof source.name === "string" ? source.name : undefined;
  const hex = normalizeHex(source.hex) ?? undefined;
  return { ...(label ? { label } : {}), ...(hex ? { hex } : {}), ...(name ? { name } : {}) };
}

export function buildMatchRequest(input: MatchRequest): MatchRequest {
  const channels = Array.isArray(input.channels) ? input.channels.map(normalizeChannel) : [];
  const paletteValue = typeof input.palette === "string" ? input.palette.toUpperCase() : "";
  const palette = paletteValue === "RYBW" || paletteValue === "CMYW" ? paletteValue : null;
  const material = typeof input.material === "string" && input.material.trim() ? input.material.trim() : null;
  const brand = typeof input.brand === "string" && input.brand.trim() ? input.brand.trim() : null;
  const maxAlternatives = Number.isInteger(input.max_alternatives)
    ? Math.min(5, Math.max(0, input.max_alternatives ?? 3))
    : 3;
  return {
    channels,
    max_alternatives: maxAlternatives,
    ...(palette ? { palette } : {}),
    ...(material ? { material } : {}),
    ...(brand ? { brand } : {}),
  };
}

function normalizeCandidate(value: unknown): MatchCandidate | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const hex = normalizeHex(source.hex);
  const buyUrl = typeof source.buy_url === "string" ? source.buy_url : "";
  if (!hex || !buyUrl) return null;
  const buyUrlKind: BuyUrlKind = source.buy_url_kind === "pdd_goods" || source.buy_url_kind === "pdd_search" || source.buy_url_kind === "other"
    ? source.buy_url_kind
    : "other";
  const matchSource: MatchSource = source.source === "tray_map" || source.source === "nearest" || source.source === "name"
    ? source.source
    : "nearest";
  const delta = typeof source.delta_e === "number" && Number.isFinite(source.delta_e) ? source.delta_e : null;
  const urls = Array.isArray(source.other_urls) ? source.other_urls.filter((item): item is string => typeof item === "string") : [];
  return {
    catalog_id: typeof source.catalog_id === "string" ? source.catalog_id : "",
    brand: typeof source.brand === "string" ? source.brand : null,
    brand_slug: typeof source.brand_slug === "string" ? source.brand_slug : null,
    series: typeof source.series === "string" ? source.series : null,
    name: typeof source.name === "string" ? source.name : "",
    hex,
    delta_e: delta,
    buy_url: buyUrl,
    buy_url_kind: buyUrlKind,
    other_urls: urls,
    price_text: typeof source.price_text === "string" ? source.price_text : null,
    source: matchSource,
  };
}

function parseValidationDetail(payload: unknown): MatchValidationIssue[] | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as Record<string, unknown>).detail;
  if (!Array.isArray(detail)) return null;
  const issues = detail.filter((item): item is MatchValidationIssue => {
    if (!item || typeof item !== "object") return false;
    const issue = item as Record<string, unknown>;
    return Array.isArray(issue.loc)
      && issue.loc.every((part) => typeof part === "string" || typeof part === "number")
      && typeof issue.msg === "string"
      && typeof issue.type === "string";
  });
  return issues.length === detail.length ? issues : null;
}

function normalizeSlot(value: unknown, index: number): MatchSlot {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const alternatives = Array.isArray(source.alternatives)
    ? source.alternatives.map(normalizeCandidate).filter((candidate): candidate is MatchCandidate => candidate !== null)
    : [];
  return {
    index: typeof source.index === "number" && Number.isInteger(source.index) ? source.index : index,
    label: typeof source.label === "string" ? source.label : null,
    input_hex: normalizeHex(source.input_hex),
    input_name: typeof source.input_name === "string" ? source.input_name : null,
    best: normalizeCandidate(source.best),
    alternatives,
    note: typeof source.note === "string" ? source.note : null,
  };
}

export function parseMatchResponse(payload: unknown): MatchResponse {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const palette = source.palette === "RYBW" || source.palette === "CMYW" ? source.palette : null;
  const slots = Array.isArray(source.slots) ? source.slots.map(normalizeSlot) : [];
  return {
    schema_version: 1,
    palette,
    slots,
    disclaimer: typeof source.disclaimer === "string" && source.disclaimer.trim() ? source.disclaimer : DEFAULT_DISCLAIMER,
  };
}

export async function fetchMatch(request: MatchRequest, options: MatchApiOptions = {}): Promise<MatchResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? MATCH_TIMEOUT_MS;
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) abortFromCaller();
    else options.signal.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  try {
    const response = await fetchImpl(options.apiUrl ?? resolveBuyApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildMatchRequest(request)),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail: MatchValidationIssue[] | null = null;
      try {
        detail = parseValidationDetail(await response.json());
      } catch {
        // Some upstream errors have no JSON body; retain the status-only error.
      }
      throw new MatchApiError("http", `Match request failed with status ${response.status}`, response.status, detail);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    return parseMatchResponse(payload);
  } catch (error) {
    if (error instanceof MatchApiError) throw error;
    if (timedOut) throw new MatchApiError("timeout", "Match request timed out");
    throw new MatchApiError("network", error instanceof Error ? error.message : "Match request failed");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export const matchFilaments = fetchMatch;
export const requestMatch = fetchMatch;
export const buildMatchPayload = buildMatchRequest;
