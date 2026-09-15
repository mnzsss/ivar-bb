import { useEffect } from "react";

export function skipWhileInFlight(fn: () => Promise<unknown>): () => void {
  let inFlight = false;
  return () => {
    if (inFlight) return;
    inFlight = true;
    void fn().finally(() => {
      inFlight = false;
    });
  };
}

// ponytail: interval polling shells out to ivar/git per tick; the ceiling is a few open panels on a mid-size hall.
// Upgrade path: push updates over bb.realtime driven by fs watchers on .ivar state and the worktrees.
export function usePolling(fn: () => Promise<unknown>, intervalMs: number) {
  useEffect(() => {
    const tick = skipWhileInFlight(fn);
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [fn, intervalMs]);
}
