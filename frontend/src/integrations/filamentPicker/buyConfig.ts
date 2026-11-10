export const DEFAULT_BUY_API_URL = "https://filament.ibaozi.com/api/lumina/match";

export interface BuyPanelConfig {
  apiUrl: string;
  panelEnabled: boolean;
  mockEnabled: boolean;
}

export type BuyConfigEnv = Record<string, unknown>;

function envString(env: BuyConfigEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
}

export function resolveBuyApiUrl(env: BuyConfigEnv = import.meta.env): string {
  const value = envString(env, "VITE_FP_BUY_API_URL")?.trim();
  return value || DEFAULT_BUY_API_URL;
}

export function isBuyPanelEnabled(env: BuyConfigEnv = import.meta.env): boolean {
  return envString(env, "VITE_FP_BUY_PANEL") === "1";
}

export function isBuyMockEnabled(env: BuyConfigEnv = import.meta.env): boolean {
  return envString(env, "VITE_FP_BUY_MOCK") === "1";
}

export function resolveBuyConfig(env: BuyConfigEnv = import.meta.env): BuyPanelConfig {
  return {
    apiUrl: resolveBuyApiUrl(env),
    panelEnabled: isBuyPanelEnabled(env),
    mockEnabled: isBuyMockEnabled(env),
  };
}
