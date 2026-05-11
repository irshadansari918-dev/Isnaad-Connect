import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/queries/me";
import { createClient } from "@/lib/supabase/server";
import { TicketDetail } from "@/components/tickets/ticket-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/login");

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select(
      "id, ticket_number, title, description, status, sla_due_at, sla_breached, created_at, resolved_at, room_id, client_org_id, assigned_am_id, creator_id, organizations!inner(name), am:users!tickets_assigned_am_id_fkey(full_name), creator:users!tickets_creator_id_fkey(full_name)",
    )
    .eq("id", id)
    .single();

  if (error || !ticket) notFound();

  // Supabase returns joined relations as arrays; normalize to single objects
  const normalized = {
    ...ticket,
    organizations: Array.isArray(ticket.organizations) ? ticket.organizations[0] : ticket.organizations,
    am: Array.isArray(ticket.am) ? ticket.am[0] ?? null : ticket.am,
    creator: Array.isArray(ticket.creator) ? ticket.creator[0] ?? null : ticket.creator,
  };

  return <TicketDetail ticket={normalized} userRole={me.role} />;
}
