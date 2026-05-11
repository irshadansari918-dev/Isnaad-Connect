import { getMe } from "@/lib/queries/me";
import { redirect } from "next/navigation";
import { TasksClient } from "@/components/tasks/tasks-client";
import { listUsers } from "@/lib/queries/admin";

export default async function TasksPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  // Load staff users for assignment dropdown
  const users = me.role !== "client"
    ? (await listUsers()).filter((u) => !u.deactivatedAt && !u.isAi)
    : [];

  return <TasksClient currentUserId={me.authId} userRole={me.role} staffUsers={users} />;
}
