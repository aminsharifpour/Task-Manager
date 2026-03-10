const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const resolveAssetUrl = (value: string, apiBase = DEFAULT_API_BASE) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  if (!raw.startsWith("/")) return raw;
  const base = String(apiBase ?? "").trim();
  if (!base) return raw;
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/\/$/, "")}${raw}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${base.replace(/\/$/, "")}${raw}`;
  }
  return `${base.replace(/\/$/, "")}${raw}`;
};
