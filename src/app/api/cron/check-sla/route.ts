import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cron/check-sla
 * Checks for SLA breaches and triggers escalation actions.
 * Should be called by a cron job (e.g., Vercel Cron) every 5 minutes.
 *
 * Protected by CRON_SECRET header in production.
 */
export async function POST(request: NextRequest) {
  // Simple auth check for cron jobs
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find tickets that have breached SLA but not yet marked
  const { data: breachedTickets, error } = await supabase
    .from("tickets")
    .select(
      "id, ticket_number, title, status, sla_due_at, assigned_am_id, room_id, client_org_id, organizations!inner(name)",
    )
    .eq("sla_breached", false)
    .in("status", ["open", "in_progress", "pending_client"])
    .lt("sla_due_at", new Date().toISOString())
    .not("sla_due_at", "is", null);

  if (error) {
    console.error("SLA check error:", error);
    return NextResponse.json({ error: "Failed to check SLA" }, { status: 500 });
  }

  if (!breachedTickets || breachedTickets.length === 0) {
    return NextResponse.json({ breached: 0 });
  }

  // Get Sanad user for system messages
  const { data: sanadUser } = await supabase
    .from("users")
    .select("id")
    .eq("is_ai", true)
    .single();

  // Get all admin users for escalation notifications
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .is("deactivated_at", null);

  let escalatedCount = 0;

  for (const ticket of breachedTickets) {
    // Mark as breached
    await supabase
      .from("tickets")
      .update({ sla_breached: true })
      .eq("id", ticket.id);

    type OrgRow = { name: string };
    const orgName = Array.isArray(ticket.organizations)
      ? (ticket.organizations as OrgRow[])[0]?.name
      : (ticket.organizations as OrgRow)?.name;

    // Post escalation message in room
    if (ticket.room_id && sanadUser) {
      await supabase.from("messages").insert({
        room_id: ticket.room_id,
        sender_id: sanadUser.id,
        kind: "system",
        body: `⚠️ SLA BREACHED: Ticket ${ticket.ticket_number} "${ticket.title}" has exceeded its SLA deadline.`,
      });
    }

    // Notify assigned AM
    if (ticket.assigned_am_id) {
      await supabase.from("notifications").insert({
        user_id: ticket.assigned_am_id,
        kind: "sla_breach",
        title: `SLA Breached: ${ticket.ticket_number}`,
        body: `Ticket "${ticket.title}" for ${orgName ?? "client"} has exceeded its SLA deadline.`,
        link: `/tickets/${ticket.id}`,
        metadata: { ticket_id: ticket.id },
      });
    }

    // Notify all admins
    if (admins && admins.length > 0) {
      const adminNotifications = admins
        .filter((a) => a.id !== ticket.assigned_am_id) // Don't double-notify
        .map((a) => ({
          user_id: a.id,
          kind: "sla_breach",
          title: `SLA Breached: ${ticket.ticket_number}`,
          body: `Ticket "${ticket.title}" for ${orgName ?? "client"} has exceeded its SLA deadline.`,
          link: `/tickets/${ticket.id}`,
          metadata: { ticket_id: ticket.id },
        }));

      if (adminNotifications.length > 0) {
        await supabase.from("notifications").insert(adminNotifications);
      }
    }

    escalatedCount++;
  }

  return NextResponse.json({ breached: escalatedCount });
}
