"use client";

import { useEffect, useRef, useState } from "react";

export type WsEvent = { type: string; payload?: unknown };

export function useWs(url: string | null) {
  const [status, setStatus] = useState<"closed" | "connecting" | "open">("closed");
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      setLastEvent(null);
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => setStatus("open");
    ws.onclose = () => {
      setStatus("closed");
      wsRef.current = null;
    };
    ws.onerror = () => setStatus("closed");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WsEvent;
        setLastEvent(data);
      } catch {
        setLastEvent({ type: "unknown", payload: e.data });
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  return { status, lastEvent };
}
