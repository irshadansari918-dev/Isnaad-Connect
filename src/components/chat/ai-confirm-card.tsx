"use client";

import { useState } from "react";
import { Check, X, Loader2, ExternalLink } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type ActionMetadata = {
  action_type: string;
  action_input: Record<string, unknown>;
  status: "pending" | "confirmed" | "cancelled";
  result_id?: string;
  result_number?: string;
};

type Props = {
  messageId: string;
  metadata: ActionMetadata;
};

export function AiConfirmCard({ messageId, metadata }: Props) {
  const [status, setStatus] = useState(metadata.status);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type?: string;
    id?: string;
    ticket_number?: string;
  } | null>(
    metadata.result_id
      ? {
          type: metadata.action_type === "create_ticket" ? "ticket" : "task",
          id: metadata.result_id,
          ticket_number: metadata.result_number,
        }
      : null,
  );
  const { t } = useLocale();

  const handleAction = async (action: "confirm" | "cancel") => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(action === "confirm" ? "confirmed" : "cancelled");
        if (action === "confirm") {
          setResult(data);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "confirmed") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs dark:border-green-800 dark:bg-green-950/30">
        <Check className="h-3.5 w-3.5 text-green-600" />
        <span className="font-medium text-green-700 dark:text-green-400">
          {t("agent.confirmed")}
        </span>
        {result?.ticket_number && (
          <a
            href={`/tickets/${result.id}`}
            className="ml-auto flex items-center gap-1 text-blue-600 hover:underline"
          >
            {result.ticket_number}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {result?.type === "task" && result.id && (
          <a
            href="/tasks"
            className="ml-auto flex items-center gap-1 text-blue-600 hover:underline"
          >
            {t("agent.viewTask")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
        <X className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{t("agent.cancelled")}</span>
      </div>
    );
  }

  // Pending — show confirm/cancel buttons
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={() => handleAction("confirm")}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50",
          "dark:border-green-700 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-900/40",
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        {t("agent.confirm")}
      </button>
      <button
        onClick={() => handleAction("cancel")}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        {t("agent.cancel")}
      </button>
    </div>
  );
}
