"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setDateLocale } from "../lib/datetime";

import { IT } from "./dictionary";
import { italianFor, translateTree } from "./dom-translate";

import { LANG_COOKIE, type Lang } from "./lang";

export type { Lang };

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translates interface text; unknown text and English pass through. */
  t: (text: string, values?: Record<string, string | number>) => string;
}

const Context = createContext<I18n>({ lang: "en", setLang: () => undefined, t: (text) => text });

function fill(text: string, values?: Record<string, string | number>) {
  return values ? text.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m)) : text;
}

export function translate(
  lang: Lang,
  text: string,
  values?: Record<string, string | number>,
): string {
  return fill(lang === "it" ? (IT[text] ?? italianFor(text) ?? text) : text, values);
}

export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/admin; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);
  // Dates and numbers follow the language; set while rendering so the first paint is right.
  setDateLocale(lang);
  // Everything built from words in code is translated on screen, including toasts and dialogs.
  useEffect(() => {
    if (lang !== "it") return;
    return translateTree(document.body);
  }, [lang]);
  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (text, values) => translate(lang, text, values) }),
    [lang, setLang],
  );
  return (
    <Context.Provider value={value}>
      <div key={lang} lang={lang} style={{ display: "contents" }}>
        {children}
      </div>
    </Context.Provider>
  );
}

export const useI18n = () => useContext(Context);
export const useT = () => useContext(Context).t;

/** Translates plain-string children / props; elements pass through. */
export function useTr() {
  const t = useT();
  return useCallback(
    <T,>(node: T): T => {
      if (typeof node === "string") return t(node) as T;
      if (Array.isArray(node)) return node.map((n) => (typeof n === "string" ? t(n) : n)) as T;
      return node;
    },
    [t],
  );
}
