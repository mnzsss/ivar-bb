import type { Exec } from "./exec.js";

export type ReviewComment = {
  id: string;
  repo: string;
  file: string;
  line_start: number;
  line_end: number;
  body: string;
  status: "open" | "resolved";
};

export type AddCommentInput = { repo: string; file: string; lineStart: number; lineEnd: number; body: string };

export type SpawnThread = (input: { repo: string; worktree: string; prompt: string; title: string }) => Promise<{ threadId: string }>;

async function ivarJson<T>(root: string, args: string[], run: Exec): Promise<T> {
  const r = await run("ivar", [...args, "--json"], root);
  if (r.code !== 0) throw new Error(r.stderr.trim() || `ivar ${args.join(" ")} exited ${r.code}`);
  return JSON.parse(r.stdout) as T;
}

export const listComments = async (root: string, feature: string, run: Exec) =>
  (await ivarJson<{ comments: ReviewComment[] }>(root, ["review", "comment", "list", feature], run)).comments;

export const addComment = (root: string, feature: string, i: AddCommentInput, run: Exec) =>
  ivarJson<ReviewComment>(
    root,
    ["review", "comment", "add", feature, "--repo", i.repo, "--file", i.file, "--lines", `${i.lineStart}-${i.lineEnd}`, "--body", i.body],
    run,
  );

export const resolveComment = (root: string, feature: string, id: string, run: Exec) =>
  ivarJson<ReviewComment>(root, ["review", "comment", "resolve", feature, id], run);

export function buildThreadPrompt(feature: string, repo: string, comments: ReviewComment[]): string {
  return [
    `Apply these review comments on feature \`${feature}\` in repo \`${repo}\`.`,
    "After addressing each one, run the resolve command shown next to it.",
    "",
    ...comments.map(
      (c) => `- ${c.file}:${c.line_start}-${c.line_end} — ${c.body}\n  resolve: \`ivar review comment resolve ${feature} ${c.id}\``,
    ),
  ].join("\n");
}

export async function sendToThreads(root: string, feature: string, run: Exec, spawn: SpawnThread) {
  const open = (await listComments(root, feature, run)).filter((c) => c.status === "open");
  const status = await ivarJson<{ repos: Array<{ repo: string; worktree: string }> }>(root, ["feature", "status", feature], run);
  const results: Array<{ repo: string; threadId: string }> = [];
  for (const { repo, worktree } of status.repos) {
    const comments = open.filter((c) => c.repo === repo);
    if (comments.length === 0) continue;
    const { threadId } = await spawn({ repo, worktree, prompt: buildThreadPrompt(feature, repo, comments), title: `Review: ${feature} / ${repo}` });
    results.push({ repo, threadId });
  }
  return results;
}
