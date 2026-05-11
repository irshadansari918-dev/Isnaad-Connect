import { getMe } from "@/lib/queries/me";
import { redirect } from "next/navigation";
import { BoardsListClient } from "@/components/boards/boards-list-client";

export default async function BoardsPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  return <BoardsListClient userRole={me.role} />;
}
