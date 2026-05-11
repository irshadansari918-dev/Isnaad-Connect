import { redirect } from "next/navigation";
import { TopBar } from "@/components/app-shell/top-bar";
import { Sidebar } from "@/components/app-shell/sidebar";
import { NotificationPrompt } from "@/components/app-shell/notification-prompt";
import { getMe, listMyRooms } from "@/lib/queries/me";
import { AppProviders } from "@/components/app-shell/providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const rooms = await listMyRooms();

  return (
    <AppProviders>
      <div className="flex min-h-screen flex-col">
        <TopBar me={me} rooms={rooms} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar rooms={rooms} isAdmin={me.role === "admin"} />
          <main className="flex-1 overflow-hidden bg-background">{children}</main>
        </div>
        <NotificationPrompt />
      </div>
    </AppProviders>
  );
}
