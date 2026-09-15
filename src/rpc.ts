import { z } from "zod";
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { ALLOWED_COMMANDS } from "./hall.js";

const projectInput = z.object({ projectId: z.string() });
const featureInput = projectInput.extend({ feature: z.string() });
const reviewComment = z.object({
  id: z.string(),
  repo: z.string(),
  file: z.string(),
  line_start: z.number(),
  line_end: z.number(),
  body: z.string(),
  status: z.enum(["open", "resolved"]),
});
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
    input: featureInput,
    output: z.object({ files: z.array(z.object({ repo: z.string(), path: z.string(), patch: z.string() })) }),
  },
  "comments.list": { input: featureInput, output: z.object({ comments: z.array(reviewComment) }) },
  "comments.add": {
    input: featureInput.extend({ repo: z.string(), file: z.string(), lineStart: z.number().int(), lineEnd: z.number().int(), body: z.string() }),
    output: reviewComment,
  },
  "comments.resolve": { input: featureInput.extend({ id: z.string() }), output: reviewComment },
  "comments.send": {
    input: featureInput,
    output: z.object({ threads: z.array(z.object({ repo: z.string(), threadId: z.string() })) }),
  },
  "hall.run": {
    input: projectInput.extend({ command: z.enum(ALLOWED_COMMANDS), args: z.array(z.string()) }),
    output: execResult,
  },
});
