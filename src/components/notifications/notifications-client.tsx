"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, MessageSquare, Ticket, AlertTriangle, CheckSquare } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const kindIcon: Record<string, React.ReactNode> = {
  mention: <MessageSquare className="h-4 w-4 text-blue-500" />,
  ticket_update: <Ticket className="h-4 w-4 text-amber-500" />,
  task_assigned: <CheckSquare className="h-4 w-4 text-green-500" />,
  sla_breach: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useLocale();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/notifications?limit=50");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    }
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <h1 className="text-sm font-semibold">{t("notifications.title")}</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--isnaad-red)] px-2 py-0.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("chat.loading")}
          </p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => {
              const isUnread = !n.read_at;
              const content = (
                <div
                  className={cn(
                    "flex items-start gap-3 px-6 py-3 transition-colors",
                    isUnread
                      ? "bg-blue-50/50 dark:bg-blue-950/10"
                      : "hover:bg-accent/30",
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {kindIcon[n.kind] ?? <Bell className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        isUnread ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              );

              if (n.link) {
                return (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => isUnread && markRead(n.id)}
                    className="block"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && markRead(n.id)}
                  className="cursor-pointer"
                >
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
