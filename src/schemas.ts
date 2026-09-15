import { z } from "zod";

export const reviewComment = z.object({
  id: z.string(),
  repo: z.string(),
  file: z.string(),
  line_start: z.number(),
  line_end: z.number(),
  body: z.string(),
  status: z.enum(["open", "resolved"]),
});
export type ReviewComment = z.infer<typeof reviewComment>;

export const commentList = z.object({ comments: z.array(reviewComment) });

export const repoStatus = z.object({
  repo: z.string(),
  worktree: z.string(),
  base: z.string().nullable(),
  worktree_present: z.boolean(),
  state: z.string(),
});

export const featureStatus = z.object({ repos: z.array(repoStatus) });

export const repoList = z.object({ repos: z.array(z.object({ name: z.string() })) });
export const featureList = z.object({ features: z.array(z.object({ name: z.string(), repos: z.array(z.string()) })) });

export const hallView = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    root: z.string(),
    repos: z.array(z.string()),
    features: z.array(z.object({ name: z.string(), promoted: z.array(z.string()) })),
  }),
  z.object({ status: z.literal("no-hall") }),
  z.object({ status: z.literal("ivar-missing") }),
]);
export type HallView = z.infer<typeof hallView>;

export const fileDiffEntry = z.object({ repo: z.string(), path: z.string(), patch: z.string() });
export type FileDiffEntry = z.infer<typeof fileDiffEntry>;

export const repoDiffError = z.object({ repo: z.string(), message: z.string() });
export type RepoDiffError = z.infer<typeof repoDiffError>;

export const featureDiffResult = z.object({ files: z.array(fileDiffEntry), errors: z.array(repoDiffError) });
