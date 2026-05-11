import { getMe } from "@/lib/queries/me";
import { redirect } from "next/navigation";
import { KanbanClient } from "@/components/boards/kanban-client";
import { listUsers } from "@/lib/queries/admin";

type Props = { params: Promise<{ id: string }> };

export default async function BoardDetailPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/login");

  const users = me.role !== "client"
    ? (await listUsers()).filter((u) => !u.deactivatedAt && !u.isAi)
    : [];

  return (
    <KanbanClient
      boardId={id}
      currentUserId={me.authId}
      userRole={me.role}
      staffUsers={users}
    />
  );
}
