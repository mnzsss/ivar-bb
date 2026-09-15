import { describe, expect, it, vi } from "vitest";
import plugin from "./server";
import { ivarRpcContract } from "./rpc";

describe("plugin", () => {
  it("registers the ivar rpc contract", async () => {
    const register = vi.fn<(contract: unknown, handlers: Record<string, unknown>) => void>();
    await plugin({ rpc: { register } } as never);
    expect(register).toHaveBeenCalledWith(
      ivarRpcContract,
      expect.objectContaining({ "hall.get": expect.any(Function) }),
    );
    expect(Object.keys(register.mock.calls[0]![1]).toSorted()).toEqual(
      Object.keys(ivarRpcContract).toSorted(),
    );
  });
});

describe("rpc contract", () => {
  const add = ivarRpcContract["comments.add"].input;
  const base = { projectId: "p", feature: "f", repo: "r", file: "a", body: "b" };
  it("accepts a positive ordered line range", () => {
    expect(add.safeParse({ ...base, lineStart: 2, lineEnd: 4 }).success).toBe(true);
  });
  it("rejects zero, fractional or reversed ranges", () => {
    expect(add.safeParse({ ...base, lineStart: 0, lineEnd: 4 }).success).toBe(false);
    expect(add.safeParse({ ...base, lineStart: 1.5, lineEnd: 4 }).success).toBe(false);
    expect(add.safeParse({ ...base, lineStart: 5, lineEnd: 4 }).success).toBe(false);
  });
  it("accepts only typed hall commands", () => {
    const run = ivarRpcContract["hall.run"].input;
    expect(
      run.safeParse({ projectId: "p", command: "promote", feature: "f", repo: "r" }).success,
    ).toBe(true);
    expect(run.safeParse({ projectId: "p", command: "promote", feature: "f" }).success).toBe(false);
    expect(run.safeParse({ projectId: "p", command: "deliver" }).success).toBe(false);
  });
});
