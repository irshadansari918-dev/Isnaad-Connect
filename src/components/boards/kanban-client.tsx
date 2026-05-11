"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, GripVertical, Plus, User, Calendar, Tag } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/lib/queries/admin";
import Link from "next/link";

type Column = {
  id: string;
  name: string;
  position: number;
  color: string;
};

type Label = {
  id: string;
  name: string;
  color: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  assignee_id: string | null;
  column_id: string | null;
  position: number;
  created_at: string;
  users: { full_name: string } | null;
  labels?: Label[];
};

type Board = {
  id: string;
  name: string;
  department_id: string | null;
  departments: { name: string; color: string } | null;
  task_columns: Column[];
};

type Props = {
  boardId: string;
  currentUserId: string;
  userRole: string;
  staffUsers: UserRow[];
};

export function KanbanClient({ boardId, currentUserId, userRole, staffUsers }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [dragTask, setDragTask] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  const loadBoard = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}`);
    if (!res.ok) return;
    const data = await res.json();
    setBoard(data.board);
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, [boardId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    if (addingTo && inputRef.current) inputRef.current.focus();
  }, [addingTo]);

  const handleAddTask = async (columnId: string) => {
    if (!newTitle.trim()) return;
    const res = await fetch(`/api/boards/${boardId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        column_id: columnId,
        assignee_id: currentUserId,
      }),
    });
    if (res.ok) {
      setNewTitle("");
      setAddingTo(null);
      loadBoard();
    }
  };

  const handleDrop = async (columnId: string) => {
    if (!dragTask || dragTask === columnId) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === dragTask ? { ...t, column_id: columnId, position: 999 } : t
      )
    );
    setDragTask(null);
    setDragOverCol(null);

    await fetch(`/api/boards/${boardId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: dragTask,
        column_id: columnId,
        position: 999,
      }),
    });

    loadBoard();
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("chat.loading")}</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-muted-foreground">Board not found</p>
      </div>
    );
  }

  const columns = board.task_columns;
  const canEdit = ["admin", "am", "internal"].includes(userRole);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
        <Link href="/boards" className="rounded-md p-1 hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          {board.departments?.color && (
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: board.departments.color }} />
          )}
          <h1 className="text-sm font-semibold">{board.name}</h1>
          {board.departments?.name && (
            <span className="text-xs text-muted-foreground">/ {board.departments.name}</span>
          )}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {tasks.length} {t("boards.tasks").toLowerCase()}
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {columns.map((col) => {
          const colTasks = tasks
            .filter((t) => t.column_id === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={col.id}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
                dragOverCol === col.id && "ring-2 ring-[var(--isnaad-navy)] bg-accent/20",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.id); }}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-xs font-semibold">{col.name}</span>
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {colTasks.map((task) => {
                  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== "done";
                  return (
                    <div
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={() => setDragTask(task.id)}
                      onDragEnd={() => { setDragTask(null); setDragOverCol(null); }}
                      className={cn(
                        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
                        dragTask === task.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
                        <div className="min-w-0 flex-1">
                          {/* Labels */}
                          {task.labels && task.labels.length > 0 && (
                            <div className="mb-1.5 flex flex-wrap gap-1">
                              {task.labels.map((label) => (
                                <span
                                  key={label.id}
                                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                                  style={{ backgroundColor: label.color }}
                                >
                                  {label.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className={cn(
                            "text-xs font-medium",
                            task.status === "done" && "line-through text-muted-foreground",
                          )}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{task.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            {task.users?.full_name && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <User className="h-2.5 w-2.5" />
                                {task.users.full_name}
                              </div>
                            )}
                            {task.due_at && (
                              <div className={cn(
                                "flex items-center gap-1 text-[10px]",
                                isOverdue ? "font-semibold text-destructive" : "text-muted-foreground",
                              )}>
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(task.due_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add task inline */}
                {addingTo === col.id ? (
                  <div className="rounded-lg border bg-card p-2">
                    <input
                      ref={inputRef}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTask(col.id);
                        if (e.key === "Escape") { setAddingTo(null); setNewTitle(""); }
                      }}
                      placeholder={t("boards.taskTitle")}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none ring-ring focus:ring-2"
                    />
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={() => handleAddTask(col.id)}
                        disabled={!newTitle.trim()}
                        className="rounded bg-[var(--isnaad-navy)] px-3 py-1 text-[10px] font-medium text-white disabled:opacity-40"
                      >
                        {t("boards.add")}
                      </button>
                      <button
                        onClick={() => { setAddingTo(null); setNewTitle(""); }}
                        className="rounded border px-2 py-1 text-[10px] hover:bg-accent"
                      >
                        {t("agent.cancel")}
                      </button>
                    </div>
                  </div>
                ) : canEdit ? (
                  <button
                    onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                    className="flex w-full items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("boards.addTask")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
