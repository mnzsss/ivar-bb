import { describe, expect, it } from "vitest";
import { skipWhileInFlight } from "./use-polling";

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
