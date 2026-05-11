import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireRole("admin");
  if (!me) redirect("/");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <AdminNav />
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
