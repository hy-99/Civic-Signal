import type { CivicEvent } from "@/lib/events/types";

type Subscriber = {
  id: string;
  filter?: (event: CivicEvent) => boolean;
  emit: (event: CivicEvent) => void;
};

type EventBus = {
  emit: (event: CivicEvent) => void;
  subscribe: (subscriber: Subscriber) => () => void;
  subscribers: () => number;
};

function createBus(): EventBus {
  const subscribers = new Set<Subscriber>();

  return {
    emit(event) {
      for (const subscriber of subscribers) {
        if (subscriber.filter && !subscriber.filter(event)) continue;
        subscriber.emit(event);
      }
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    subscribers() {
      return subscribers.size;
    },
  };
}

declare global {
  var __civicsignalEventBus: EventBus | undefined;
}

export const bus = globalThis.__civicsignalEventBus ?? (globalThis.__civicsignalEventBus = createBus());
