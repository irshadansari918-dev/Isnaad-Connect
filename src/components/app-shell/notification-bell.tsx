"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications?unread_only=true&limit=1");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread_count ?? 0);
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    fetchCount();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
    >
      <Bell className="h-3.5 w-3.5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--isnaad-red)] px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
