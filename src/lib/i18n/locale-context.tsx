"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Locale, StringKey } from "./strings";
import { t as translate } from "./strings";

type LocaleContextValue = {
  locale: Locale;
  toggleLocale: () => void;
  t: (key: StringKey) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  toggleLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  // Persist choice in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("isc-locale") as Locale | null;
    if (saved === "ar" || saved === "en") setLocale(saved);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next = prev === "en" ? "ar" : "en";
      localStorage.setItem("isc-locale", next);
      // Update <html> dir and lang attributes
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  // Set initial dir on mount
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: StringKey) => translate(key, locale),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, toggleLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
