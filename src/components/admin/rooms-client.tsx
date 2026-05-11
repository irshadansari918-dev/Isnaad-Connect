"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { OrgRow, RoomRow, UserRow } from "@/lib/queries/admin";

type Props = {
  initialRooms: RoomRow[];
  clientOrgs: OrgRow[];
  users: UserRow[];
};

export function RoomsClient({ initialRooms, clientOrgs, users }: Props) {
  const [rooms, setRooms] = useState(initialRooms);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "internal" as string, client_org_id: "", member_ids: [] as string[] });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLocale();

  const handleCreate = async () => {
    if (!form.name.trim() || creating) return;
    if (form.kind === "client" && !form.client_org_id) { setError("Select a client org"); return; }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          kind: form.kind,
          client_org_id: form.kind === "client" ? form.client_org_id : undefined,
          member_ids: form.member_ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRooms((prev) => [
        {
          id: data.room.id,
          kind: data.room.kind,
          name: data.room.name,
          clientOrgId: form.client_org_id || null,
          clientOrgName: clientOrgs.find((o) => o.id === form.client_org_id)?.name ?? null,
          archivedAt: null,
          memberCount: form.member_ids.length,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setForm({ name: "", kind: "internal", client_org_id: "", member_ids: [] });
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: "archive" | "restore") => {
    const res = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, archivedAt: action === "archive" ? new Date().toISOString() : null } : r,
        ),
      );
    }
  };

  const toggleMember = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter((id) => id !== userId)
        : [...prev.member_ids, userId],
    }));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("admin.rooms")}</h2>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-[var(--isnaad-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {t("admin.create")}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.name")}</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Logistics Team" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.kind")}</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                <option value="internal">Internal</option>
                <option value="client">Client</option>
              </select>
            </div>
            {form.kind === "client" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.clientOrg")}</label>
                <select value={form.client_org_id} onChange={(e) => setForm({ ...form, client_org_id: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                  <option value="">{t("admin.selectOrg")}</option>
                  {clientOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.selectMembers")}</label>
              <div className="max-h-40 overflow-y-auto rounded-md border bg-background p-2">
                {users.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent">
                    <input type="checkbox" checked={form.member_ids.includes(u.id)} onChange={() => toggleMember(u.id)} className="rounded" />
                    <span className="text-sm">{u.fullName}</span>
                    <span className="text-[10px] text-muted-foreground">{u.role} · {u.orgName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !form.name.trim()} className="rounded-md bg-[var(--isnaad-navy)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40">{t("admin.create")}</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-start font-medium">{t("admin.name")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.kind")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.clientOrg")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.members")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.status")}</th>
              <th className="px-4 py-2 text-end font-medium">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("admin.noData")}</td></tr>
            )}
            {rooms.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${r.kind === "client" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {r.kind}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">{r.clientOrgName ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{r.memberCount}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${r.archivedAt ? "text-muted-foreground" : "text-green-600"}`}>
                    {r.archivedAt ? t("admin.archived") : t("admin.active")}
                  </span>
                </td>
                <td className="px-4 py-2 text-end">
                  <button
                    onClick={() => handleAction(r.id, r.archivedAt ? "restore" : "archive")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {r.archivedAt ? t("admin.restore") : t("admin.archive")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
