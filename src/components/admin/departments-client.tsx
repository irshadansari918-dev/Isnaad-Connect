"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, Users, X, Trash2, Link as LinkIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/lib/queries/admin";
import Link from "next/link";

type Department = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  headId: string | null;
  roomId: string | null;
  orgId: string;
  orgName: string;
  memberCount: number;
  createdAt: string;
};

type DeptDetail = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  head_id: string | null;
  room_id: string | null;
  members: {
    userId: string;
    isHead: boolean;
    fullName: string;
    email: string;
    role: string;
  }[];
};

type Props = {
  staffUsers: UserRow[];
  isnaadOrgId: string;
};

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export function DepartmentsClient({ staffUsers, isnaadOrgId }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: COLORS[0], head_id: "" });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<DeptDetail | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const { t } = useLocale();

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/departments");
    const data = await res.json();
    setDepartments(data.departments ?? []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/departments/${id}`);
    const data = await res.json();
    setSelected(data.department ?? null);
  }, []);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);

  const handleCreate = async () => {
    if (!form.name.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        color: form.color,
        head_id: form.head_id || null,
        org_id: isnaadOrgId,
      }),
    });
    if (res.ok) {
      setForm({ name: "", description: "", color: COLORS[0], head_id: "" });
      setShowForm(false);
      loadDepartments();
    }
    setCreating(false);
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archive this department?")) return;
    await fetch(`/api/departments/${id}`, { method: "DELETE" });
    loadDepartments();
    if (selected?.id === id) setSelected(null);
  };

  const handleAddMember = async () => {
    if (!selected || !addUserId) return;
    await fetch(`/api/departments/${selected.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: addUserId }),
    });
    setAddUserId("");
    loadDetail(selected.id);
    loadDepartments();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selected) return;
    await fetch(`/api/departments/${selected.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    loadDetail(selected.id);
    loadDepartments();
  };

  // Filter users not already in selected department
  const availableUsers = selected
    ? staffUsers.filter((u) => !selected.members.some((m) => m.userId === u.id))
    : staffUsers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("admin.departments")}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-md bg-[var(--isnaad-navy)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("admin.create")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("admin.name")}
              className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("admin.description") || "Description"}
              className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
            <select
              value={form.head_id}
              onChange={(e) => setForm({ ...form, head_id: e.target.value })}
              className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            >
              <option value="">{t("admin.deptHead")}</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("admin.color")}:</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    form.color === c ? "scale-110 border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">
              {t("agent.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
              className="rounded-md bg-[var(--isnaad-navy)] px-4 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {t("admin.create")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">{t("chat.loading")}</p>
      ) : departments.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t("admin.noData")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <button
              key={dept.id}
              onClick={() => loadDetail(dept.id)}
              className={cn(
                "group relative rounded-lg border p-4 text-left transition-all hover:shadow-md",
                selected?.id === dept.id && "ring-2 ring-[var(--isnaad-navy)]",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: dept.color }}
                >
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{dept.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{dept.memberCount} {t("chat.members").toLowerCase()}</span>
                  </div>
                  {dept.description && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{dept.description}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleArchive(dept.id); }}
                  className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Department detail panel */}
      {selected && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: departments.find((d) => d.id === selected.id)?.color }}
              />
              <h3 className="text-sm font-semibold">{selected.name}</h3>
              {selected.room_id && (
                <Link
                  href={`/rooms/${selected.room_id}`}
                  className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium hover:bg-accent/80"
                >
                  <LinkIcon className="h-3 w-3" />
                  {t("admin.deptRoom")}
                </Link>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Members list */}
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.members")} ({selected.members.length})</p>
            <div className="mt-2 space-y-1">
              {selected.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{m.fullName}</span>
                    {m.isHead && (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        {t("admin.head")}
                      </span>
                    )}
                    <p className="text-[10px] text-muted-foreground">{m.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="rounded p-1 hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add member */}
            <div className="mt-3 flex gap-2">
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              >
                <option value="">{t("admin.selectMembers")}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={!addUserId}
                className="rounded-md bg-[var(--isnaad-navy)] px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
