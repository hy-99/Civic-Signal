import type { CivicEvent } from "@/lib/events/types";

export const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
} as const;

export function formatSseEvent(event: CivicEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function formatSseRetry(milliseconds: number) {
  return `retry: ${milliseconds}\n\n`;
}

export function formatSseHeartbeat() {
  return ": heartbeat\n\n";
}
