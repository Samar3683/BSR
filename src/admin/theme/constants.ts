export type ThemePreference = "system" | "light" | "dark";

export const THEME_COOKIE = "bsr-admin-theme";

export function parseTheme(value: string | undefined | null): ThemePreference {
  return value === "dark" || value === "system" || value === "light" ? value : "light";
}
