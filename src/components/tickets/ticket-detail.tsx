"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  status: string;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  resolved_at: string | null;
  room_id: string | null;
  organizations: { name: string };
  am: { full_name: string } | null;
  creator: { full_name: string } | null;
};

const statuses = ["open", "in_progress", "pending_client", "resolved", "closed"];

export function TicketDetail({ ticket, userRole }: { ticket: Ticket; userRole: string }) {
  const [status, setStatus] = useState(ticket.status);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const { t } = useLocale();
  const isClient = userRole === "client";

  const slaMs = ticket.sla_due_at ? new Date(ticket.sla_due_at).getTime() - Date.now() : null;
  const slaLabel =
    ticket.sla_breached || (slaMs !== null && slaMs <= 0)
      ? t("tickets.breached")
      : slaMs !== null && slaMs < 2 * 60 * 60 * 1000
        ? t("tickets.warning")
        : t("tickets.onTrack");
  const slaColor =
    ticket.sla_breached || (slaMs !== null && slaMs <= 0)
      ? "text-destructive"
      : slaMs !== null && slaMs < 2 * 60 * 60 * 1000
        ? "text-amber-600"
        : "text-green-600";

  const changeStatus = async (newStatus: string) => {
    setUpdating(true);
    const res = await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    }
    setUpdating(false);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link href="/tickets" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("tickets.title")}
      </Link>

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
            <h1 className="mt-1 text-lg font-semibold">{ticket.title}</h1>
          </div>
          <span className={cn("font-semibold", slaColor)}>
            {["resolved", "closed"].includes(status) ? "✓ " + t("tickets.resolved") : slaLabel}
          </span>
        </div>

        {ticket.description && (
          <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">{t("tickets.client")}</span>
            <p className="font-medium">{ticket.organizations.name}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{t("tickets.assignedAm")}</span>
            <p className="font-medium">{ticket.am?.full_name ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{t("admin.created")}</span>
            <p>{new Date(ticket.created_at).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{t("tickets.sla")}</span>
            <p>{ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : "—"}</p>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs text-muted-foreground">{t("admin.status")}</span>
          <div className="flex flex-wrap gap-2">
            {statuses
              .filter((s) => (isClient ? s === "resolved" || s === status : true))
              .map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={s === status || updating}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    s === status ? "border-[var(--isnaad-red)] bg-[var(--isnaad-red)]/10 text-[var(--isnaad-red)]" : "hover:bg-accent disabled:opacity-40",
                  )}
                >
                  {s.replace("_", " ").toUpperCase()}
                </button>
              ))}
          </div>
        </div>

        {ticket.room_id && (
          <div className="mt-4 border-t pt-4">
            <Link href={`/rooms/${ticket.room_id}`} className="text-xs text-blue-600 hover:underline">
              Go to room →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
