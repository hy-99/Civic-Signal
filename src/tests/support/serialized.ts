const SERIAL_TEST_KEY = Symbol.for("civicsignal.test.serial.queue");

type GlobalQueueState = typeof globalThis & {
  [SERIAL_TEST_KEY]?: Promise<void>;
};

export async function withSerializedTest<T>(run: () => Promise<T> | T): Promise<T> {
  const scope = globalThis as GlobalQueueState;
  const current = scope[SERIAL_TEST_KEY] || Promise.resolve();

  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  scope[SERIAL_TEST_KEY] = current.then(() => next);

  await current;
  try {
    return await run();
  } finally {
    release();
    if (scope[SERIAL_TEST_KEY] === next) {
      delete scope[SERIAL_TEST_KEY];
    }
  }
}
