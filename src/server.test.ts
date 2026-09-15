import { describe, expect, it, vi } from "vitest";
import plugin from "./server";
import { ivarRpcContract } from "./rpc";

describe("plugin", () => {
  it("registers the ivar rpc contract", async () => {
    const register = vi.fn();
    await plugin({ rpc: { register } } as never);
    expect(register).toHaveBeenCalledWith(ivarRpcContract, expect.objectContaining({ ping: expect.any(Function) }));
  });
});
