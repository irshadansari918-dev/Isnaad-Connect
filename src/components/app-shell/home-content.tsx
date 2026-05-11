"use client";

import { useLocale } from "@/lib/i18n/locale-context";

export function HomeContent({ fullName }: { fullName: string | null }) {
  const { t } = useLocale();

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("app.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fullName
            ? `${fullName} — ${t("chat.firstMessage")}`
            : "Loading…"}
        </p>
      </div>
    </div>
  );
}
