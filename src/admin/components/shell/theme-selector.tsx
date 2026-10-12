"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useT } from "../../i18n/provider";
import type { ThemePreference } from "../../theme/constants";
import { useTheme } from "../../theme/theme-provider";
import { Select } from "../ui/form";

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/** System / Light / Dark appearance, remembered per browser. */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  const Icon = ICONS[theme];
  return (
    <label className="a-theme">
      <Icon aria-hidden="true" />
      <Select
        aria-label={t("Color theme")}
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemePreference)}
      >
        <option value="system">{t("System")}</option>
        <option value="light">{t("Light")}</option>
        <option value="dark">{t("Dark")}</option>
      </Select>
    </label>
  );
}
