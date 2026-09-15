import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { ivarRpcContract } from "./rpc.js";

export default async function plugin(bb: BbPluginApi): Promise<void> {
  bb.rpc.register(ivarRpcContract, { ping: async () => ({ ok: true as const }) });
}
