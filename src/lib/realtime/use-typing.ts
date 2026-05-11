"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TypingUser = {
  userId: string;
  fullName: string;
};

/**
 * Typing indicator using Supabase Presence.
 * Broadcasts typing state to all room members.
 */
export function useTyping(roomId: string, userId: string, fullName: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`typing:${roomId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        for (const [key, presences] of Object.entries(state)) {
          if (key === userId) continue;
          const p = presences[0] as { userId: string; fullName: string; typing: boolean } | undefined;
          if (p?.typing) {
            users.push({ userId: p.userId, fullName: p.fullName });
          }
        }
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, fullName, typing: false });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, fullName]);

  const startTyping = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.track({ userId, fullName, typing: true });
    }
    // Auto-stop after 3 seconds of no input
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.track({ userId, fullName, typing: false });
      }
    }, 3000);
  }, [userId, fullName]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (channelRef.current) {
      channelRef.current.track({ userId, fullName, typing: false });
    }
  }, [userId, fullName]);

  return { typingUsers, startTyping, stopTyping };
}
