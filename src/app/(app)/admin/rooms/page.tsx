import { listRooms, listOrganizations, listUsers } from "@/lib/queries/admin";
import { RoomsClient } from "@/components/admin/rooms-client";

export default async function RoomsPage() {
  const [rooms, orgs, users] = await Promise.all([
    listRooms(),
    listOrganizations(),
    listUsers(),
  ]);
  const activeOrgs = orgs.filter((o) => !o.archivedAt && o.kind === "client");
  const activeUsers = users.filter((u) => !u.deactivatedAt && !u.isAi);
  return <RoomsClient initialRooms={rooms} clientOrgs={activeOrgs} users={activeUsers} />;
}
