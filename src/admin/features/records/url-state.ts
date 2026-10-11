"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * List state (search, filters, sort, page) mirrored in the URL.
 *
 * Changes go through the native History API, which Next.js syncs with
 * useSearchParams without a server round trip. Each change starts from the
 * live URL, so quick successive changes (a filter right after a search)
 * never overwrite each other.
 */
export function useUrlState() {
  const params = useSearchParams();
  const pathname = usePathname();

  const get = useCallback((key: string) => params.get(key), [params]);

  const update = useCallback(
    (
      patch: Record<string, string | number | null | undefined>,
      options: { resetPage?: boolean } = {},
    ) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (options.resetPage) next.delete("page");
      const query = next.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname],
  );

  return { get, update, params };
}

export function parseJsonParam<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
