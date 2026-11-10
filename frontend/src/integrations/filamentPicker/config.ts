export interface FilamentPickerEnv {
  VITE_FP_INTEGRATION?: string;
  VITE_FP_SITE_URL?: string;
  VITE_FP_SOURCE_URL?: string;
  VITE_FP_HIDE_LOCAL_ONLY?: string;
}

export type FilamentPickerLinkId = "site" | "catalog" | "plan" | "cost" | "source";

export interface FilamentPickerLink {
  id: FilamentPickerLinkId;
  labelKey: string;
  href: string;
  target?: "_blank";
}

export interface FilamentPickerConfig {
  integrationEnabled: boolean;
  hideLocalOnly: boolean;
  siteUrl: string;
  sourceUrl: string;
  links: readonly FilamentPickerLink[];
}

export const DEFAULT_FILAMENT_PICKER_SITE_URL = "https://filament.ibaozi.com/";
export const DEFAULT_FILAMENT_PICKER_SOURCE_URL =
  "https://github.com/a523959108-rgb/filament-lumina";

function isEnabled(value: string | undefined): boolean {
  return value?.trim() === "1";
}

function readUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  const url = trimmed || fallback;
  return `${url.replace(/\/+$/, "")}/`;
}

/**
 * Resolve the optional filament-picker integration from Vite environment values.
 * The explicit environment argument keeps this function deterministic and easy to test.
 */
export function getFilamentPickerConfig(
  env: FilamentPickerEnv | ImportMetaEnv = import.meta.env,
): FilamentPickerConfig {
  const integrationEnabled = isEnabled(env.VITE_FP_INTEGRATION ?? "0");
  const hideLocalOnly = env.VITE_FP_HIDE_LOCAL_ONLY === undefined
    ? integrationEnabled
    : isEnabled(env.VITE_FP_HIDE_LOCAL_ONLY);
  const siteUrl = readUrl(env.VITE_FP_SITE_URL, DEFAULT_FILAMENT_PICKER_SITE_URL);
  const sourceUrl = readUrl(env.VITE_FP_SOURCE_URL, DEFAULT_FILAMENT_PICKER_SOURCE_URL).replace(/\/$/, "");

  return {
    integrationEnabled,
    hideLocalOnly,
    siteUrl,
    sourceUrl,
    links: [
      { id: "site", labelKey: "filament_picker_site", href: siteUrl },
      { id: "catalog", labelKey: "filament_picker_catalog", href: siteUrl },
      { id: "plan", labelKey: "filament_picker_plan", href: `${siteUrl}#/plan` },
      { id: "cost", labelKey: "filament_picker_cost", href: `${siteUrl}#/cost` },
      {
        id: "source",
        labelKey: "filament_picker_source",
        href: sourceUrl,
        target: "_blank",
      },
    ],
  };
}
