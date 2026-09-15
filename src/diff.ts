import type { Exec } from "./exec.js";

export type FileDiffEntry = { repo: string; path: string; patch: string };

type RepoStatus = { repo: string; worktree: string; base: string | null; worktree_present: boolean };

export function splitPatch(repo: string, unified: string): FileDiffEntry[] {
  return unified
    .split(/^(?=diff --git )/m)
    .filter((chunk) => chunk.startsWith("diff --git "))
    .map((chunk) => ({ repo, path: chunk.match(/^diff --git a\/.+? b\/(.+)$/m)![1]!, patch: chunk }));
}

export async function featureDiff(root: string, feature: string, run: Exec): Promise<FileDiffEntry[]> {
  const status: { repos: RepoStatus[] } = JSON.parse((await run("ivar", ["feature", "status", feature, "--json"], root)).stdout);
  const perRepo = await Promise.all(
    status.repos
      .filter((r): r is RepoStatus & { base: string } => r.worktree_present && !!r.base)
      .map(async (r) => {
        const base = (await run("git", ["merge-base", r.base, "HEAD"], r.worktree)).stdout.trim();
        const diff = await run("git", ["diff", "--no-color", "--no-ext-diff", base], r.worktree);
        return [...splitPatch(r.repo, diff.stdout), ...(await untrackedDiff(r.repo, r.worktree, run))];
      }),
  );
  return perRepo.flat();
}

async function untrackedDiff(repo: string, worktree: string, run: Exec): Promise<FileDiffEntry[]> {
  const listed = await run("git", ["ls-files", "--others", "--exclude-standard", "-z"], worktree);
  const files = listed.stdout.split("\0").filter(Boolean);
  const patches = await Promise.all(
    files.map(async (path) => {
      const diff = await run("git", ["diff", "--no-color", "--no-ext-diff", "--no-index", "--", "/dev/null", path], worktree);
      return diff.code <= 1 && diff.stdout ? { repo, path, patch: diff.stdout } : null;
    }),
  );
  return patches.filter((p): p is FileDiffEntry => p !== null);
}
