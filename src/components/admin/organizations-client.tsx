"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { OrgRow } from "@/lib/queries/admin";

export function OrganizationsClient({ initialOrgs }: { initialOrgs: OrgRow[] }) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLocale();

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setOrgs((prev) => [
        { id: data.organization.id, kind: "client", name: data.organization.name, portalOrgId: null, archivedAt: null, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setName("");
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: "archive" | "restore") => {
    const res = await fetch("/api/admin/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, archivedAt: action === "archive" ? new Date().toISOString() : null }
            : o,
        ),
      );
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("admin.name")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Aramex Saudi"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="rounded-md bg-[var(--isnaad-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {t("admin.create")}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-start font-medium">{t("admin.name")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.kind")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.status")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.created")}</th>
              <th className="px-4 py-2 text-end font-medium">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("admin.noData")}</td></tr>
            )}
            {orgs.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-medium">{o.name}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${o.kind === "isnaad" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                    {o.kind}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${o.archivedAt ? "text-muted-foreground" : "text-green-600"}`}>
                    {o.archivedAt ? t("admin.archived") : t("admin.active")}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-end">
                  {o.kind === "client" && (
                    <button
                      onClick={() => handleAction(o.id, o.archivedAt ? "restore" : "archive")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {o.archivedAt ? t("admin.restore") : t("admin.archive")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
