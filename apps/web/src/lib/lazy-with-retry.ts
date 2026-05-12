import { lazy } from "react";

const DYNAMIC_IMPORT_REFRESH_KEY = "task_app_dynamic_import_refresh_v1";

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type LazyWithPreload<T extends React.ComponentType<any>> = React.LazyExoticComponent<T> & {
  preload: () => Promise<unknown>;
};

export const lazyWithRetry = <T extends { default: React.ComponentType<any> }>(
  importer: () => Promise<T>,
  chunkLabel: string,
) => {
  const load = async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const mod = await importer();
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(DYNAMIC_IMPORT_REFRESH_KEY);
        }
        return mod;
      } catch (error) {
        lastError = error;
        if (attempt < 2 && typeof window !== "undefined") {
          await sleep(250 * (attempt + 1));
          continue;
        }
      }
    }

    const message = String((lastError as Error)?.message ?? lastError ?? "");
    const isDynamicImportFetchError =
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);

    if (isDynamicImportFetchError && typeof window !== "undefined") {
      const refreshKey = `${DYNAMIC_IMPORT_REFRESH_KEY}:${chunkLabel}`;
      const refreshed = sessionStorage.getItem(refreshKey) === "1";
      if (!refreshed) {
        sessionStorage.setItem(refreshKey, "1");
        window.location.reload();
        await new Promise(() => undefined);
      }
    }

    throw lastError;
  };

  return Object.assign(lazy(load), {
    preload: () => load(),
  }) as LazyWithPreload<T["default"]>;
};
