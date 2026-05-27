type QueueTask<T> = () => Promise<T> | T;

export function createJobQueue({ concurrency = 1 }: { concurrency?: number } = {}) {
  const limit = Math.max(1, Math.floor(concurrency));
  const pending: Array<() => void> = [];
  let active = 0;

  const runNext = () => {
    if (active >= limit) return;
    const next = pending.shift();
    if (!next) return;
    next();
  };

  return {
    enqueue<T>(task: QueueTask<T>) {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          active += 1;
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              active -= 1;
              runNext();
            });
        };

        if (active < limit) {
          start();
          return;
        }

        pending.push(start);
      });
    },
    active() {
      return active;
    },
    pending() {
      return pending.length;
    },
  };
}
