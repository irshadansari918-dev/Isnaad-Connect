"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";
import type { RoomListItem } from "@/lib/queries/me";

export function Sidebar({ rooms }: { rooms: RoomListItem[] }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.rooms")}
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {rooms.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {t("app.noRooms")}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rooms.map((r) => {
              const isActive = pathname === `/rooms/${r.id}`;
              return (
                <li key={r.id}>
                  <Link
                    href={`/rooms/${r.id}`}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <span className="text-muted-foreground">
                      {r.kind === "client"
                        ? "#"
                        : r.kind === "internal"
                          ? "@"
                          : "·"}
                    </span>
                    <span className="truncate">{r.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
