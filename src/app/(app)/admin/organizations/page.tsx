import { listOrganizations } from "@/lib/queries/admin";
import { OrganizationsClient } from "@/components/admin/organizations-client";

export default async function OrganizationsPage() {
  const orgs = await listOrganizations();
  return <OrganizationsClient initialOrgs={orgs} />;
}
