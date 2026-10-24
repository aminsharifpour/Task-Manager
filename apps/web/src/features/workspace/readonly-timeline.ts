import type { Request } from "./use-module";

/**
 * The timeline is a browsing surface. It must not provide a second edit form.
 * The full task editor uses the original API and server-authorized permissions.
 */
export function timelinePreviewApi(api: Request): Request {
  return async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    if (!["GET", "HEAD"].includes((options.method || "GET").toUpperCase()))
      throw new Error("برای تغییر تسک از دکمه ویرایش تسک استفاده کنید.");
    const result = await api<T>(path, options);
    if (!path.startsWith("/tasks/timeline?")) return result;
    const page = result as { items?: Record<string, unknown>[] };
    if (!Array.isArray(page?.items)) return result;
    return { ...page, items: page.items.map(row => ({ ...row, canEdit: false })) } as T;
  };
}
