/**
 * Runs `callback` when the browser is idle (or after `timeout` ms at the
 * latest). Returns a cancel function. Falls back to a timer where
 * requestIdleCallback is unavailable (Safari).
 */
export function onIdle(callback: () => void, timeout = 1500): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, Math.min(timeout, 200));
  return () => window.clearTimeout(handle);
}
