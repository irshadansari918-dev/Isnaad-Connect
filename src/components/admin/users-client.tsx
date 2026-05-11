"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { OrgRow, UserRow } from "@/lib/queries/admin";

type Props = {
  initialUsers: UserRow[];
  organizations: OrgRow[];
};

export function UsersClient({ initialUsers, organizations }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "client", org_id: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLocale();

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.org_id || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          org_id: form.org_id,
          password: form.password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      const orgName = organizations.find((o) => o.id === form.org_id)?.name ?? "";
      setUsers((prev) => [
        { id: data.user.id, email: data.user.email, fullName: data.user.full_name, role: data.user.role, orgId: form.org_id, orgName, isAi: false, deactivatedAt: null, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setForm({ email: "", full_name: "", role: "client", org_id: "", password: "" });
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: "deactivate" | "reactivate") => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, deactivatedAt: action === "deactivate" ? new Date().toISOString() : null }
            : u,
        ),
      );
    }
  };

  const handleInvite = async (email: string) => {
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.link ? `Magic link: ${data.link}` : data.message);
    } else {
      alert(data.error);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("admin.users")}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-[var(--isnaad-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t("admin.create")}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.email")}</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.fullName")}</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ahmed Ali" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.role")}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                <option value="client">Client</option>
                <option value="am">Account Manager</option>
                <option value="internal">Internal</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.organization")}</label>
              <select value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                <option value="">{t("admin.selectOrg")}</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.kind})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.password")} ({t("admin.optional")})</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="Leave blank for magic link" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2" />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !form.email || !form.full_name || !form.org_id} className="rounded-md bg-[var(--isnaad-navy)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40">{t("admin.create")}</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-start font-medium">{t("admin.name")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.email")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.role")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.organization")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("admin.status")}</th>
              <th className="px-4 py-2 text-end font-medium">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("admin.noData")}</td></tr>
            )}
            {users.filter((u) => !u.isAi).map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-medium">{u.fullName}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{u.role}</span>
                </td>
                <td className="px-4 py-2 text-xs">{u.orgName}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${u.deactivatedAt ? "text-destructive" : "text-green-600"}`}>
                    {u.deactivatedAt ? t("admin.deactivated") : t("admin.active")}
                  </span>
                </td>
                <td className="px-4 py-2 text-end">
                  <div className="flex items-center justify-end gap-2">
                    {u.role === "client" && (
                      <button onClick={() => handleInvite(u.email)} className="text-xs text-blue-600 hover:underline">{t("admin.invite")}</button>
                    )}
                    <button
                      onClick={() => handleAction(u.id, u.deactivatedAt ? "reactivate" : "deactivate")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {u.deactivatedAt ? t("admin.reactivate") : t("admin.deactivate")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
