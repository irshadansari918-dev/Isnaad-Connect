"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/lib/queries/room";

type RealtimePayload = {
  new: {
    id: string;
    room_id: string;
    sender_id: string;
    kind: MessageRow["kind"];
    body: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  };
};

/**
 * Client-side hook that manages message state for a room:
 * - Initialises with server-fetched messages
 * - Subscribes to Supabase Realtime INSERT events
 * - Provides sendMessage() helper
 * - Provides loadMore() for pagination
 */
export function useMessages(roomId: string, initial: MessageRow[]) {
  const [messages, setMessages] = useState<MessageRow[]>(initial);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initial.length >= 50);
  const membersCache = useRef<Map<string, MessageRow["sender"]>>(new Map());

  // Seed cache with initial senders
  useEffect(() => {
    initial.forEach((m) => membersCache.current.set(m.sender_id, m.sender));
  }, [initial]);

  // Subscribe to realtime inserts
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: RealtimePayload) => {
          const row = payload.new;

          // Avoid duplicates (our own optimistic insert)
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;

            // Try to resolve sender from cache, otherwise use a placeholder
            let sender = membersCache.current.get(row.sender_id);
            if (!sender) {
              // Fetch sender info
              supabase
                .from("users")
                .select("id, full_name, role, is_ai")
                .eq("id", row.sender_id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    const s = {
                      id: data.id,
                      full_name: data.full_name,
                      role: data.role as string,
                      is_ai: data.is_ai,
                    };
                    membersCache.current.set(row.sender_id, s);
                    // Re-render with correct sender
                    setMessages((msgs) =>
                      msgs.map((m) =>
                        m.id === row.id ? { ...m, sender: s } : m,
                      ),
                    );
                  }
                });
              sender = {
                id: row.sender_id,
                full_name: "...",
                role: "internal",
                is_ai: false,
              };
            }

            return [
              ...prev,
              {
                id: row.id,
                room_id: row.room_id,
                sender_id: row.sender_id,
                kind: row.kind,
                body: row.body,
                metadata: row.metadata ?? {},
                created_at: row.created_at,
                sender,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendMessage = useCallback(
    async (body: string, replyToId?: string | null) => {
      if (!body.trim() || sending) return;
      setSending(true);
      try {
        const payload: Record<string, unknown> = { room_id: roomId, body };
        if (replyToId) payload.reply_to_id = replyToId;

        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error("Send failed:", err);
        }
      } finally {
        setSending(false);
      }
    },
    [roomId, sending],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const res = await fetch(
        `/api/messages?room_id=${roomId}&before=${oldest.created_at}&limit=50`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const older: MessageRow[] = data.messages ?? [];
      setHasMore(data.hasMore ?? false);
      if (older.length > 0) {
        older.forEach((m: MessageRow) => membersCache.current.set(m.sender_id, m.sender));
        setMessages((prev) => [...older, ...prev]);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, messages, loadingMore, hasMore]);

  return { messages, sendMessage, sending, loadMore, loadingMore, hasMore };
}
