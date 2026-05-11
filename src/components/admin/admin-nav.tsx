"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/organizations", key: "admin.organizations" as const },
  { href: "/admin/users", key: "admin.users" as const },
  { href: "/admin/rooms", key: "admin.rooms" as const },
  { href: "/admin/departments", key: "admin.departments" as const },
];

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <div className="border-b bg-card px-6">
      <div className="flex items-center gap-1">
        <h1 className="mr-4 text-sm font-semibold">{t("admin.title")}</h1>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-3 text-xs font-medium transition-colors",
              pathname.startsWith(tab.href)
                ? "border-[var(--isnaad-red)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        ))}
      </div>
    </div>
  );
}
