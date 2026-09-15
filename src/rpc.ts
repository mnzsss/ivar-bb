import { z } from "zod";
import { defineRpcContract } from "@get-bb/plugin-sdk";

export const ivarRpcContract = defineRpcContract({
  ping: { input: z.object({}), output: z.object({ ok: z.literal(true) }) },
});
