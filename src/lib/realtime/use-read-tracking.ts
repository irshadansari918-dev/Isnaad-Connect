"use client";

import { useEffect, useRef } from "react";

/**
 * Marks the latest message as read whenever the message list changes
 * and the window is focused.
 */
export function useReadTracking(roomId: string, latestMessageId: string | null) {
  const lastMarked = useRef<string | null>(null);

  useEffect(() => {
    if (!latestMessageId || latestMessageId === lastMarked.current) return;
    if (document.hidden) return;

    lastMarked.current = latestMessageId;

    fetch(`/api/rooms/${roomId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: latestMessageId }),
    }).catch(() => {
      // Best-effort — don't block UI
    });
  }, [roomId, latestMessageId]);

  // Also mark as read when tab regains focus
  useEffect(() => {
    const handler = () => {
      if (!document.hidden && lastMarked.current !== latestMessageId && latestMessageId) {
        lastMarked.current = latestMessageId;
        fetch(`/api/rooms/${roomId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: latestMessageId }),
        }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [roomId, latestMessageId]);
}
