"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { THEME_COOKIE, type ThemePreference } from "./constants";

interface ThemeContext {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const Context = createContext<ThemeContext>({ theme: "light", setTheme: () => undefined });

/**
 * The saved preference is read on the server (cookie) so the first paint is
 * already themed; "system" follows the OS through a CSS media query, so it
 * also updates live when the OS appearance changes.
 */
export function ThemeProvider({
  initial,
  children,
}: {
  initial: ThemePreference;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initial);
  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/admin; max-age=31536000; samesite=lax`;
    document.querySelector(".adm")?.setAttribute("data-theme", next);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useTheme = () => useContext(Context);
