import { listUsers, listOrganizations } from "@/lib/queries/admin";
import { UsersClient } from "@/components/admin/users-client";

export default async function UsersPage() {
  const [users, orgs] = await Promise.all([listUsers(), listOrganizations()]);
  const activeOrgs = orgs.filter((o) => !o.archivedAt);
  return <UsersClient initialUsers={users} organizations={activeOrgs} />;
}
