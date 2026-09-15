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
export type RepoStatus = z.infer<typeof repoStatus>;

export const featureStatus = z.object({ repos: z.array(repoStatus) });
export type FeatureStatus = z.infer<typeof featureStatus>;

export const repoList = z.object({ repos: z.array(z.object({ name: z.string() })) });
export const featureList = z.object({ features: z.array(z.object({ name: z.string(), repos: z.array(z.string()) })) });
