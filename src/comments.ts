import { ivarJson, type Exec } from "./exec.js";
import { commentList, featureStatus, reviewComment, type ReviewComment } from "./schemas.js";

export type AddCommentInput = { repo: string; file: string; lineStart: number; lineEnd: number; body: string };

export type SpawnThread = (input: { repo: string; worktree: string; prompt: string; title: string }) => Promise<{ threadId: string }>;

export const listComments = async (root: string, feature: string, run: Exec) =>
  (await ivarJson(root, ["review", "comment", "list", "--", feature], run, commentList)).comments;

export const addComment = (root: string, feature: string, i: AddCommentInput, run: Exec) =>
  ivarJson(
    root,
    ["review", "comment", "add", `--repo=${i.repo}`, `--file=${i.file}`, `--lines=${i.lineStart}-${i.lineEnd}`, `--body=${i.body}`, "--", feature],
    run,
    reviewComment,
  );

export const resolveComment = (root: string, feature: string, id: string, run: Exec) =>
  ivarJson(root, ["review", "comment", "resolve", "--", feature, id], run, reviewComment);

export function buildThreadPrompt(feature: string, repo: string, comments: ReviewComment[], ivarBin = "ivar"): string {
  return [
    `Apply these review comments on feature \`${feature}\` in repo \`${repo}\`.`,
    "After addressing each one, run the resolve command shown next to it.",
    "",
    ...comments.map(
      (c) => `- ${c.file}:${c.line_start}-${c.line_end} — ${c.body}\n  resolve: \`${ivarBin} review comment resolve ${feature} ${c.id}\``,
    ),
  ].join("\n");
}

export async function sendToThreads(root: string, feature: string, run: Exec, spawn: SpawnThread, ivarBin = "ivar") {
  const open = (await listComments(root, feature, run)).filter((c) => c.status === "open");
  const status = await ivarJson(root, ["feature", "status", "--", feature], run, featureStatus);
  const results: Array<{ repo: string; threadId: string }> = [];
  for (const { repo, worktree } of status.repos) {
    const comments = open.filter((c) => c.repo === repo);
    if (comments.length === 0) continue;
    const { threadId } = await spawn({ repo, worktree, prompt: buildThreadPrompt(feature, repo, comments, ivarBin), title: `Review: ${feature} / ${repo}` });
    results.push({ repo, threadId });
  }
  return results;
}
