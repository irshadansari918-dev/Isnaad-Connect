import { redirect } from "next/navigation";
import { getMe } from "@/lib/queries/me";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export default async function NotificationsPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  return <NotificationsClient />;
}
