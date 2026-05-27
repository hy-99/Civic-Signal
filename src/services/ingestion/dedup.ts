import { loadState } from "@/lib/data-store";

export async function getExistingExternalIds(source_feed_id: string) {
  const state = await loadState();
  return new Set(
    state.public_signals
      .filter((signal) => signal.source_feed_id === source_feed_id && typeof signal.external_id === "string" && signal.external_id.length > 0)
      .map((signal) => signal.external_id as string),
  );
}
