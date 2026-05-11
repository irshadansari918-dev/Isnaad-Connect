import { requireRole } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { DepartmentsClient } from "@/components/admin/departments-client";
import { listUsers, listOrganizations } from "@/lib/queries/admin";

export default async function DepartmentsPage() {
  const me = await requireRole("admin");
  if (!me) redirect("/");

  const [users, orgs] = await Promise.all([listUsers(), listOrganizations()]);
  const staffUsers = users.filter((u) => !u.deactivatedAt && !u.isAi && u.role !== "client");
  const isnaadOrg = orgs.find((o) => o.kind === "isnaad");

  return (
    <DepartmentsClient
      staffUsers={staffUsers}
      isnaadOrgId={isnaadOrg?.id ?? ""}
    />
  );
}
