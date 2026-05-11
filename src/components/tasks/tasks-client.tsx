"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Circle, Clock, XCircle } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/lib/queries/admin";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  assignee_id: string | null;
  users: { full_name: string } | null;
  creator: { full_name: string } | null;
};

type Filter = "mine" | "all" | "overdue";

type Props = {
  currentUserId: string;
  userRole: string;
  staffUsers: UserRow[];
};

const statusIcon = {
  open: <Circle className="h-4 w-4 text-slate-400" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  done: <CheckCircle className="h-4 w-4 text-green-500" />,
  cancelled: <XCircle className="h-4 w-4 text-muted-foreground" />,
};

export function TasksClient({ currentUserId, userRole, staffUsers }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("mine");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignee_id: "", due_at: "" });
  const [creating, setCreating] = useState(false);
  const { t } = useLocale();

  const loadTasks = useCallback(async (f: Filter) => {
    setLoading(true);
    const res = await fetch(`/api/tasks?filter=${f}`);
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(filter); }, [filter, loadTasks]);

  const handleCreate = async () => {
    if (!form.title.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        assignee_id: form.assignee_id || currentUserId,
        due_at: form.due_at || null,
      }),
    });
    if (res.ok) {
      setForm({ title: "", description: "", assignee_id: "", due_at: "" });
      setShowForm(false);
      loadTasks(filter);
    }
    setCreating(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadTasks(filter);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "mine", label: t("tasks.filterMine") },
    { key: "all", label: t("tasks.filterAll") },
    { key: "overdue", label: t("tasks.filterOverdue") },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{t("tasks.title")}</h1>
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-[var(--isnaad-navy)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90">
          {t("tasks.create")}
        </button>
      </div>

      {showForm && (
        <div className="border-b bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("admin.name")} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 sm:col-span-2" />
            {staffUsers.length > 0 && (
              <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                <option value="">{t("tasks.assignee")}</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            )}
            <input type="date" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2" />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !form.title.trim()} className="rounded-md bg-[var(--isnaad-navy)] px-4 py-1 text-xs font-medium text-white disabled:opacity-40">{t("admin.create")}</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{t("chat.loading")}</p>
        ) : tasks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t("tasks.noTasks")}</p>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => {
              const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== "done" && task.status !== "cancelled";
              return (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/30">
                  <button onClick={() => updateStatus(task.id, task.status === "done" ? "open" : "done")} className="shrink-0">
                    {statusIcon[task.status]}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {task.users?.full_name && <span>{task.users.full_name}</span>}
                      {task.due_at && (
                        <span className={isOverdue ? "font-semibold text-destructive" : ""}>
                          {new Date(task.due_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    value={task.status}
                    onChange={(e) => updateStatus(task.id, e.target.value)}
                    className="rounded border bg-background px-2 py-1 text-[10px]"
                  >
                    <option value="open">{t("tasks.open")}</option>
                    <option value="in_progress">{t("tasks.inProgress")}</option>
                    <option value="done">{t("tasks.done")}</option>
                    <option value="cancelled">{t("tasks.cancelled")}</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
