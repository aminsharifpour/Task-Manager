export const normalizeUiMessage = (message: string, fallback: string) => {
  const text = message.trim();
  if (!text) return fallback;
  const questionMarks = text.match(/\?/g)?.length ?? 0;
  return questionMarks >= 3 ? fallback : message;
};

export const requestJson = async <T>(
  apiBase: string,
  authTokenStorageKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const token = localStorage.getItem(authTokenStorageKey);
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const raw = await res.text();
    let message = raw;
    try {
      const payload = JSON.parse(raw) as { message?: unknown };
      message = String(payload?.message ?? raw);
    } catch {
      message = raw;
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const raw = await res.text();
  if (!raw.trim()) return undefined as T;
  const contentType = String(res.headers.get("content-type") ?? "").toLowerCase();
  const looksJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
  if (!contentType.includes("application/json") && !looksJson) {
    throw new Error("پاسخ سرور JSON نیست. احتمالا بک‌اند ری‌استارت نشده یا مسیر API اشتباه است.");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("پاسخ JSON نامعتبر از سرور دریافت شد.");
  }
};
