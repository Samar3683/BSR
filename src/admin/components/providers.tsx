"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { toAdminError } from "../lib/errors";
import { ToastProvider } from "./ui/toast";

/** Client providers of the admin area only (never part of the public tree). */
export function AdminProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (count, error) => {
              const kind = toAdminError(error).kind;
              return count < 2 && (kind === "network" || kind === "unknown");
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
