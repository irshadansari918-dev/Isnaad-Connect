"use client";

import { LocaleProvider } from "@/lib/i18n/locale-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
