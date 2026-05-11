"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { OrgRow, UserRow } from "@/lib/queries/admin";

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  resolved_at: string | null;
  organizations: { name: string };
  am: { full_name: string } | null;
  creator: { full_name: string } | null;
};

type Props = {
  currentUserId: string;
  userRole: string;
  userOrgId: string;
  ams: UserRow[];
  clientOrgs: OrgRow[];
};

function slaState(dueAt: string | null, breached: boolean): "breached" | "warning" | "ok" | "none" {
  if (breached) return "breached";
  if (!dueAt) return "none";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) return "breached";
  if (diff < 2 * 60 * 60 * 1000) return "warning";
  return "ok";
}

function slaCountdown(dueAt: string | null): string {
  if (!dueAt) return "—";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) return "Overdue";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  pending_client: "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-600",
};

export function TicketsClient({ currentUserId, userRole, userOrgId, ams, clientOrgs }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", client_org_id: "", assigned_am_id: "", sla_hours: "24" });
  const [creating, setCreating] = useState(false);
  const { t } = useLocale();
  const isClient = userRole === "client";

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/tickets");
    const data = await res.json();
    setTickets(data.tickets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleCreate = async () => {
    if (!form.title.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        client_org_id: isClient ? userOrgId : form.client_org_id,
        assigned_am_id: form.assigned_am_id || null,
        sla_hours: Number(form.sla_hours) || 24,
      }),
    });
    if (res.ok) {
      setForm({ title: "", description: "", client_org_id: "", assigned_am_id: "", sla_hours: "24" });
      setShowForm(false);
      loadTickets();
    }
    setCreating(false);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <h1 className="text-sm font-semibold">{t("tickets.title")}</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-[var(--isnaad-red)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90">
          {t("tickets.create")}
        </button>
      </div>

      {showForm && (
        <div className="border-b bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("admin.name")} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 sm:col-span-2" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("tickets.description")} rows={2} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 sm:col-span-2" />
            {!isClient && (
              <select value={form.client_org_id} onChange={(e) => setForm({ ...form, client_org_id: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                <option value="">{t("tickets.client")}</option>
                {clientOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            {!isClient && (
              <select value={form.assigned_am_id} onChange={(e) => setForm({ ...form, assigned_am_id: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2">
                <option value="">{t("tickets.assignedAm")}</option>
                {ams.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("tickets.slaHours")}</label>
              <input type="number" min={1} max={720} value={form.sla_hours} onChange={(e) => setForm({ ...form, sla_hours: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !form.title.trim() || (!isClient && !form.client_org_id)} className="rounded-md bg-[var(--isnaad-red)] px-4 py-1 text-xs font-medium text-white disabled:opacity-40">{t("admin.create")}</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("chat.loading")}</p>
        ) : tickets.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("tickets.noTickets")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">{t("tickets.ticketNumber")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("admin.name")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("admin.status")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("tickets.sla")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("tickets.client")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("tickets.assignedAm")}</th>
                  <th className="px-4 py-2 text-start font-medium">{t("admin.created")}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((tk) => {
                  const sla = slaState(tk.sla_due_at, tk.sla_breached);
                  const resolved = ["resolved", "closed"].includes(tk.status);
                  return (
                    <tr key={tk.id} className="border-t hover:bg-accent/20">
                      <td className="px-4 py-2">
                        <Link href={`/tickets/${tk.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">{tk.ticket_number}</Link>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2 font-medium">{tk.title}</td>
                      <td className="px-4 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColors[tk.status] ?? statusColors.open)}>
                          {tk.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {resolved ? (
                          <span className="text-xs text-green-600">Resolved</span>
                        ) : (
                          <span className={cn("text-xs font-medium", sla === "breached" ? "text-destructive" : sla === "warning" ? "text-amber-600" : "text-green-600")}>
                            {slaCountdown(tk.sla_due_at)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{tk.organizations?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{tk.am?.full_name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(tk.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
