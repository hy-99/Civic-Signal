import { bus } from "@/lib/events/bus";
import { formatSseEvent, formatSseHeartbeat, formatSseRetry, SSE_HEADERS } from "@/lib/events/sse";
import { eventStreamQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;
const RETRY_INTERVAL_MS = 1_000;

export async function GET(request: Request) {
  const query = eventStreamQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  const types = new Set(query.types);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const write = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", handleAbort);
        controller.close();
      };

      const handleAbort = () => {
        cleanup();
      };

      const unsubscribe = bus.subscribe({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        filter(event) {
          if (types.size === 0) return true;
          return types.has(event.type);
        },
        emit(event) {
          write(formatSseEvent(event));
        },
      });

      write(formatSseRetry(RETRY_INTERVAL_MS));
      heartbeat = setInterval(() => {
        write(formatSseHeartbeat());
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", handleAbort, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
