/**
 * A tiny global loading signal. The top progress bar subscribes to it; route
 * navigations and "major" async operations drive it. Reference-counted so
 * overlapping operations don't end the bar early.
 *
 *   loader.start();           // begin
 *   try { await work(); }
 *   finally { loader.done(); } // end
 *
 *   await loader.wrap(work()); // convenience for a single promise
 */
type Listener = (active: boolean) => void;

let count = 0;
const listeners = new Set<Listener>();

function emit() {
  const active = count > 0;
  for (const l of listeners) l(active);
}

export const loader = {
  start() {
    count += 1;
    if (count === 1) emit();
  },
  done() {
    if (count === 0) return;
    count -= 1;
    if (count === 0) emit();
  },
  /** Force the bar off (e.g. a safety timeout). */
  reset() {
    if (count === 0) return;
    count = 0;
    emit();
  },
  isActive() {
    return count > 0;
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async wrap<T>(promise: Promise<T>): Promise<T> {
    loader.start();
    try {
      return await promise;
    } finally {
      loader.done();
    }
  },
};
