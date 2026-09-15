import { describe, expect, it, vi } from "vitest";
import { pollWhileVisible, skipWhileInFlight } from "./use-polling";

describe("skipWhileInFlight", () => {
  it("ignores ticks while the previous call is pending and resumes after it settles", async () => {
    let calls = 0;
    let finish!: () => void;
    const tick = skipWhileInFlight(() => {
      calls++;
      return new Promise<void>((r) => {
        finish = r;
      });
    });
    tick();
    tick();
    expect(calls).toBe(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    tick();
    expect(calls).toBe(2);
  });
});

describe("pollWhileVisible", () => {
  it("skips interval ticks while hidden and refreshes as soon as the page is visible", () => {
    vi.useFakeTimers();
    let hidden = false;
    let notifyVisible = () => {};
    let calls = 0;
    const stop = pollWhileVisible(
      () => {
        calls++;
      },
      1000,
      {
        isHidden: () => hidden,
        onVisible: (listener) => {
          notifyVisible = listener;
          return () => {
            notifyVisible = () => {};
          };
        },
      },
    );
    expect(calls).toBe(1);
    hidden = true;
    vi.advanceTimersByTime(3000);
    expect(calls).toBe(1);
    hidden = false;
    notifyVisible();
    expect(calls).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(calls).toBe(3);
    stop();
    vi.advanceTimersByTime(5000);
    notifyVisible();
    expect(calls).toBe(3);
    vi.useRealTimers();
  });
});
