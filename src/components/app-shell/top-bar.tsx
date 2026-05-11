"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Settings, CheckSquare, Ticket } from "lucide-react";
import type { Me } from "@/lib/queries/me";
import type { RoomListItem } from "@/lib/queries/me";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export function TopBar({
  me,
  rooms,
}: {
  me: Me;
  rooms?: RoomListItem[];
}) {
  const { t, toggleLocale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="mr-1 rounded-md p-1.5 hover:bg-accent md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--isnaad-red)] text-xs font-bold text-white">
            I
          </div>
          <span className="text-sm font-semibold tracking-tight">
            {t("app.title")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLocale}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            {t("lang.toggle")}
          </button>
          <div className="hidden text-xs text-muted-foreground sm:flex sm:flex-col sm:items-end">
            <span className="font-medium text-foreground">{me.fullName}</span>
            <span>
              {me.role.toUpperCase()} · {me.orgName}
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {t("app.signOut")}
            </button>
          </form>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-72 border-r bg-card shadow-lg">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.rooms")}
              </h2>
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2">
              {rooms && rooms.length > 0 ? (
                <ul className="space-y-0.5">
                  {rooms.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/rooms/${r.id}`}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                          pathname === `/rooms/${r.id}`
                            ? "bg-accent font-medium"
                            : "hover:bg-accent/50",
                        )}
                      >
                        <span className="text-muted-foreground">
                          {r.kind === "client" ? "#" : r.kind === "internal" ? "@" : "·"}
                        </span>
                        <span className="truncate">{r.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-4 text-xs text-muted-foreground">{t("app.noRooms")}</p>
              )}
            </nav>
            <div className="border-t px-2 py-2 space-y-0.5">
              <Link
                href="/tasks"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  pathname.startsWith("/tasks") ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>{t("nav.tasks")}</span>
              </Link>
              <Link
                href="/tickets"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  pathname.startsWith("/tickets") ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Ticket className="h-3.5 w-3.5" />
                <span>{t("nav.tickets")}</span>
              </Link>
              {me.role === "admin" && (
                <Link
                  href="/admin/organizations"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                    pathname.startsWith("/admin") ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>{t("nav.admin")}</span>
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
