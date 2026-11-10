/**
 * Helpers for endpoints that Lumina only exposes to the local desktop/app.
 * 判断当前页面是否运行在本地应用来源上，以及某条 API 是否仅限本地调用。
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const LOCAL_ONLY_PATH_PREFIXES = [
  "/system/settings",
  "/system/3mf-templates",
  "/system/machine-registry/bed-model",
  "/system/clear-cache",
  "/slicer",
  "/feedback/bug-report",
  "/extractor/gradient-card-materials",
  "/extractor/material-solver-cache",
  "/extractor/material-solver-caches",
  "/extractor/material-solver-runtime",
] as const;

export function isLocalLuminaAppOrigin(hostname?: string): boolean {
  const source =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  const normalized = source.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return LOOPBACK_HOSTS.has(normalized);
}

export function normalizeApiPath(url?: string | null, baseURL?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  let pathname = trimmed;
  try {
    const base =
      baseURL && /^https?:\/\//i.test(baseURL)
        ? baseURL
        : "http://lumina.local";
    const resolved = new URL(trimmed, base.endsWith("/") ? base : `${base}/`);
    pathname = resolved.pathname;
  } catch {
    const q = trimmed.search(/[?#]/);
    pathname = q === -1 ? trimmed : trimmed.slice(0, q);
  }

  if (pathname.startsWith("/api/")) {
    return pathname.slice(4);
  }
  if (pathname === "/api") {
    return "/";
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function pathHasPrefix(path: string, prefix: string): boolean {
  return (
    path === prefix ||
    path.startsWith(`${prefix}/`) ||
    path.startsWith(`${prefix}?`)
  );
}

export function isLocalOnlyApiPath(
  url?: string | null,
  baseURL?: string | null,
): boolean {
  const path = normalizeApiPath(url, baseURL);
  return LOCAL_ONLY_PATH_PREFIXES.some((prefix) => pathHasPrefix(path, prefix));
}
