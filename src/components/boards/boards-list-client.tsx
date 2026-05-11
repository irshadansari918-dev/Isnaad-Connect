"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, Plus } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import Link from "next/link";

type Board = {
  id: string;
  name: string;
  department_id: string | null;
  departments: { name: string; color: string } | null;
  task_columns: { id: string; name: string }[];
};

type Props = { userRole: string };

export function BoardsListClient({ userRole }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { t } = useLocale();

  const loadBoards = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/boards");
    const data = await res.json();
    setBoards(data.boards ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setName("");
      setShowForm(false);
      loadBoards();
    }
    setCreating(false);
  };

  const canCreate = ["admin", "am", "internal"].includes(userRole);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <h1 className="text-sm font-semibold">{t("boards.title")}</h1>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-md bg-[var(--isnaad-navy)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("boards.create")}
          </button>
        )}
      </div>

      {showForm && (
        <div className="border-b bg-card p-4">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("admin.name")}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">
              {t("agent.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded-md bg-[var(--isnaad-navy)] px-4 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {t("admin.create")}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{t("chat.loading")}</p>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20">
            <LayoutDashboard className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("boards.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
                className="group rounded-lg border p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: board.departments?.color ?? "#3B82F6" }}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-[var(--isnaad-navy)]">
                      {board.name}
                    </p>
                    {board.departments?.name && (
                      <p className="text-[10px] text-muted-foreground">{board.departments.name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {board.task_columns?.length ?? 0} {t("boards.columns").toLowerCase()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
