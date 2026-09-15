import { z } from "zod";
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { featureDiffResult, hallView, reviewComment } from "./schemas.js";

const projectInput = z.object({ projectId: z.string() });
const featureInput = projectInput.extend({ feature: z.string().min(1) });
const lineNumber = z.number().int().positive();

export const ivarRpcContract = defineRpcContract({
  "hall.get": { input: projectInput, output: hallView },
  "feature.diff": { input: featureInput, output: featureDiffResult },
  "comments.list": { input: featureInput, output: z.object({ comments: z.array(reviewComment) }) },
  "comments.add": {
    input: featureInput
      .extend({
        repo: z.string(),
        file: z.string(),
        lineStart: lineNumber,
        lineEnd: lineNumber,
        body: z.string(),
      })
      .refine((i) => i.lineStart <= i.lineEnd, {
        message: "lineStart must not exceed lineEnd",
        path: ["lineEnd"],
      }),
    output: reviewComment,
  },
  "comments.resolve": { input: featureInput.extend({ id: z.string() }), output: reviewComment },
  "comments.send": {
    input: featureInput,
    output: z.object({ threads: z.array(z.object({ repo: z.string(), threadId: z.string() })) }),
  },
  "hall.run": {
    input: z.discriminatedUnion("command", [
      projectInput.extend({ command: z.literal("sync") }),
      projectInput.extend({ command: z.literal("feature create"), name: z.string().min(1) }),
      projectInput.extend({
        command: z.literal("promote"),
        feature: z.string().min(1),
        repo: z.string().min(1),
      }),
    ]),
    output: z.object({ code: z.number(), stdout: z.string(), stderr: z.string() }),
  },
});
