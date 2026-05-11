import { getMe } from "@/lib/queries/me";
import { redirect } from "next/navigation";
import { TicketsClient } from "@/components/tickets/tickets-client";
import { listUsers, listOrganizations } from "@/lib/queries/admin";

export default async function TicketsPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const isStaff = me.role !== "client";
  const [users, orgs] = isStaff
    ? await Promise.all([listUsers(), listOrganizations()])
    : [[], []];

  const ams = users.filter((u) => (u.role === "am" || u.role === "admin") && !u.deactivatedAt);
  const clientOrgs = orgs.filter((o) => o.kind === "client" && !o.archivedAt);

  return (
    <TicketsClient
      currentUserId={me.authId}
      userRole={me.role}
      userOrgId={me.orgId}
      ams={ams}
      clientOrgs={clientOrgs}
    />
  );
}
