"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { EntityKey } from "../lib/fields/types";
import { fetchAdminConfig, type AdminConfig } from "../services/config";
import { fetchRecordNames } from "../services/records";

export const CONFIG_KEY = ["admin-config"] as const;

/** Entity and field configuration (refreshed after every settings change). */
export function useAdminConfig() {
  return useQuery<AdminConfig>({
    queryKey: CONFIG_KEY,
    queryFn: fetchAdminConfig,
    staleTime: 30_000,
  });
}

/** Invalidates everything derived from records after a mutation. */
export function useInvalidateData() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== CONFIG_KEY[0] }),
    [client],
  );
}

export function useInvalidateConfig() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries(), [client]);
}

/** Display names of related records, for relation fields. */
export function useRecordNames(entity: EntityKey | null, ids: readonly string[]) {
  const unique = [...new Set(ids.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["record-names", entity, unique],
    queryFn: async () => {
      if (!entity) return {} as Record<string, string>;
      const rows = await fetchRecordNames(entity, unique);
      return Object.fromEntries(rows.map((r) => [r.id, r.display_name])) as Record<string, string>;
    },
    enabled: Boolean(entity) && unique.length > 0,
    staleTime: 60_000,
  });
}
