import { z } from "zod";
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { ALLOWED_COMMANDS } from "./hall.js";

const projectInput = z.object({ projectId: z.string() });
const execResult = z.object({ code: z.number(), stdout: z.string(), stderr: z.string() });

export const ivarRpcContract = defineRpcContract({
  ping: { input: z.object({}), output: z.object({ ok: z.literal(true) }) },
  "hall.get": {
    input: projectInput,
    output: z.discriminatedUnion("status", [
      z.object({
        status: z.literal("ok"),
        root: z.string(),
        repos: z.array(z.unknown()),
        features: z.array(z.object({ name: z.string(), status: z.unknown() })),
      }),
      z.object({ status: z.literal("no-hall") }),
      z.object({ status: z.literal("ivar-missing") }),
    ]),
  },
  "feature.diff": {
    input: projectInput.extend({ feature: z.string() }),
    output: z.object({ files: z.array(z.object({ repo: z.string(), path: z.string(), patch: z.string() })) }),
  },
  "hall.run": {
    input: projectInput.extend({ command: z.enum(ALLOWED_COMMANDS), args: z.array(z.string()) }),
    output: execResult,
  },
});
