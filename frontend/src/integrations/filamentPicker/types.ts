export interface MatchChannel {
  label?: string | null;
  hex?: string | null;
  name?: string | null;
}

export interface MatchRequest {
  channels: MatchChannel[];
  palette?: "RYBW" | "CMYW" | null;
  material?: string | null;
  brand?: string | null;
  max_alternatives?: number;
}

export type BuyUrlKind = "pdd_goods" | "pdd_search" | "other";
export type MatchSource = "tray_map" | "nearest" | "name";

export interface MatchCandidate {
  catalog_id: string;
  brand: string | null;
  brand_slug: string | null;
  series: string | null;
  name: string;
  hex: string;
  delta_e: number | null;
  buy_url: string;
  buy_url_kind: BuyUrlKind;
  other_urls: string[];
  price_text: string | null;
  source: MatchSource;
}

export interface MatchSlot {
  index: number;
  label: string | null;
  input_hex: string | null;
  input_name: string | null;
  best: MatchCandidate | null;
  alternatives: MatchCandidate[];
  note: string | null;
}

export interface MatchResponse {
  schema_version: 1;
  palette: "RYBW" | "CMYW" | null;
  slots: MatchSlot[];
  disclaimer: string;
}

export interface BuyPanelChannelSource {
  label?: string;
  hex?: string;
  name?: string;
}

export interface MatchValidationIssue {
  loc: Array<string | number>;
  msg: string;
  type: string;
}
