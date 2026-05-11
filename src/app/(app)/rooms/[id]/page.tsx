import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/queries/me";
import { getRoom, getInitialMessages } from "@/lib/queries/room";
import { ChatView } from "@/components/chat/chat-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/login");

  const room = await getRoom(id);
  if (!room) notFound();

  const messages = await getInitialMessages(id);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <ChatView
        room={room}
        initialMessages={messages}
        currentUserId={me.authId}
        userRole={me.role}
      />
    </div>
  );
}
