"use client";

import { LocaleProvider } from "@/lib/i18n/locale-context";
import { useServiceWorker } from "@/lib/pwa/use-service-worker";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  return <LocaleProvider>{children}</LocaleProvider>;
}
