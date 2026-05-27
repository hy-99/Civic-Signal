"use client";

import { useEffect, useEffectEvent } from "react";

import { EVENT_NAMES, type EventName, type CivicEvent } from "@/lib/events/types";

const MAX_RECONNECT_DELAY_MS = 10_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export function buildEventStreamUrl(options?: { types?: EventName[] }) {
  const params = new URLSearchParams();
  if (options?.types?.length) {
    params.set("types", options.types.join(","));
  }
  const query = params.toString();
  return query ? `/api/events/stream?${query}` : "/api/events/stream";
}

export function getReconnectDelay(attempt: number) {
  return Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
}

export function useEventStream({
  types,
  onEvent,
}: {
  types?: EventName[];
  onEvent: (event: CivicEvent) => void;
}) {
  const handleEvent = useEffectEvent(onEvent);
  const typesKey = types?.length ? types.join(",") : "";

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let closed = false;
    const listenerTypes = typesKey ? (typesKey.split(",") as EventName[]) : [...EVENT_NAMES];
    const url = buildEventStreamUrl({ types: listenerTypes });

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;
      clearReconnectTimer();
      source?.close();
      source = new EventSource(url);
      const handleMessage = (message: MessageEvent<string>) => {
        if (!message.data) return;
        handleEvent(JSON.parse(message.data) as CivicEvent);
      };

      source.onopen = () => {
        reconnectAttempt = 0;
      };

      for (const eventType of listenerTypes) {
        source.addEventListener(eventType, handleMessage as EventListener);
      }

      source.onerror = () => {
        for (const eventType of listenerTypes) {
          source?.removeEventListener(eventType, handleMessage as EventListener);
        }
        source?.close();
        source = null;
        if (closed) return;
        const delay = getReconnectDelay(reconnectAttempt);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      source?.close();
    };
  }, [typesKey]);
}
