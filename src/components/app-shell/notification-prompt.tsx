"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    // Only show if notifications are supported and not yet decided
    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      !sessionStorage.getItem("notification-dismissed")
    ) {
      // Delay showing to avoid interrupting initial load
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const requestPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Register for push if we have a service worker
      const reg = await navigator.serviceWorker?.ready;
      if (reg) {
        console.log("Push ready via SW:", reg.scope);
      }
    }
    setShow(false);
  };

  const dismiss = () => {
    sessionStorage.setItem("notification-dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300 sm:left-auto">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--isnaad-navy)]/10">
          <Bell className="h-4 w-4 text-[var(--isnaad-navy)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{t("notifications.enable")}</p>
          <p className="text-xs text-muted-foreground">
            {t("notifications.description")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={requestPermission}
            className="rounded-md bg-[var(--isnaad-navy)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            {t("notifications.allow")}
          </button>
          <button
            onClick={dismiss}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
