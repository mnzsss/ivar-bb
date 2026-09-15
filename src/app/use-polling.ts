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
  useEffect(
    () => pollWhileVisible(skipWhileInFlight(fn), intervalMs, documentVisibility),
    [fn, intervalMs],
  );
}

export type Visibility = { isHidden(): boolean; onVisible(listener: () => void): () => void };

export function pollWhileVisible(tick: () => void, intervalMs: number, visibility: Visibility) {
  tick();
  const timer = setInterval(() => {
    if (!visibility.isHidden()) tick();
  }, intervalMs);
  const stopListening = visibility.onVisible(tick);
  return () => {
    clearInterval(timer);
    stopListening();
  };
}

export const documentVisibility: Visibility = {
  isHidden: () => document.visibilityState === "hidden",
  onVisible: (listener) => {
    const handle = () => {
      if (document.visibilityState === "visible") listener();
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  },
};
