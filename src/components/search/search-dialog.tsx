"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, MessageSquare, CheckSquare, Ticket, Loader2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type SearchResults = {
  messages: Array<{
    id: string;
    room_id: string;
    body: string | null;
    sender_name: string;
    room_name: string;
    created_at: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee_name: string | null;
    created_at: string;
  }>;
  tickets: Array<{
    id: string;
    ticket_number: string;
    title: string;
    status: string;
    org_name: string;
    created_at: string;
  }>;
};

export function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "messages" | "tasks" | "tickets">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const { t } = useLocale();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Cmd+K / Ctrl+K to open (handled by parent)
  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&type=${activeTab}`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } finally {
        setLoading(false);
      }
    },
    [activeTab],
  );

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const navigate = (path: string) => {
    onClose();
    router.push(path);
  };

  if (!open) return null;

  const totalResults =
    (results?.messages.length ?? 0) +
    (results?.tasks.length ?? 0) +
    (results?.tickets.length ?? 0);

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: "all", label: t("search.all") },
    { key: "messages", label: t("search.messages") },
    { key: "tasks", label: t("search.tasks") },
    { key: "tickets", label: t("search.tickets") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-4 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (query.length >= 2) search(query);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!results && !loading && (
            <p className="p-6 text-center text-xs text-muted-foreground">
              {t("search.hint")}
            </p>
          )}

          {results && totalResults === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">
              {t("search.noResults")}
            </p>
          )}

          {/* Messages */}
          {results && results.messages.length > 0 && (
            <div>
              <div className="bg-muted/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("search.messages")}
              </div>
              {results.messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/rooms/${m.room_id}`)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {m.body
                        ? m.body.length > 100
                          ? m.body.slice(0, 100) + "…"
                          : m.body
                        : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.sender_name} in {m.room_name} ·{" "}
                      {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Tasks */}
          {results && results.tasks.length > 0 && (
            <div>
              <div className="bg-muted/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("search.tasks")}
              </div>
              {results.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => navigate("/tasks")}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {task.status.replace("_", " ")}
                      {task.assignee_name ? ` · ${task.assignee_name}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Tickets */}
          {results && results.tickets.length > 0 && (
            <div>
              <div className="bg-muted/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("search.tickets")}
              </div>
              {results.tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {ticket.ticket_number}
                      </span>{" "}
                      <span className="font-medium">{ticket.title}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ticket.status.replace("_", " ")} · {ticket.org_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ESC
          </kbd>{" "}
          {t("search.close")}
        </div>
      </div>
    </div>
  );
}
