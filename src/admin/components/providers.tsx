"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { LanguageProvider, type Lang } from "../i18n/provider";
import { toAdminError } from "../lib/errors";
import type { ThemePreference } from "../theme/constants";
import { ThemeProvider } from "../theme/theme-provider";
import { ToastProvider } from "./ui/toast";

/** Client providers of the admin area only (never part of the public tree). */
export function AdminProviders({
  children,
  lang,
  theme,
}: {
  children: ReactNode;
  lang: Lang;
  theme: ThemePreference;
}) {
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
      <LanguageProvider initial={lang}>
        <ThemeProvider initial={theme}>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
