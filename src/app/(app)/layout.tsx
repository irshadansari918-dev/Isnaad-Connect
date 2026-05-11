import { redirect } from "next/navigation";
import { TopBar } from "@/components/app-shell/top-bar";
import { Sidebar } from "@/components/app-shell/sidebar";
import { getMe, listMyRooms } from "@/lib/queries/me";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const rooms = await listMyRooms();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar me={me} />
      <div className="flex flex-1">
        <Sidebar rooms={rooms} />
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
