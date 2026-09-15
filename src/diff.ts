import { checked, ivarJson, type Exec } from "./exec.js";
import { featureStatus, type FileDiffEntry, type RepoDiffError } from "./schemas.js";

export type { FileDiffEntry, RepoDiffError } from "./schemas.js";

const GIT_DIFF = ["-c", "core.quotePath=false", "diff", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"];

function lineValue(chunk: string, prefix: string): string | null {
  const line = chunk.split("\n").find((l) => l.startsWith(prefix));
  return line ? line.slice(prefix.length).replace(/\t$/, "") : null;
}

function headerPath(chunk: string): string | null {
  const rest = chunk.slice("diff --git a/".length, chunk.indexOf("\n") === -1 ? undefined : chunk.indexOf("\n"));
  const half = (rest.length - 3) / 2;
  return Number.isInteger(half) && half > 0 && rest.slice(half, half + 3) === " b/" && rest.slice(0, half) === rest.slice(half + 3)
    ? rest.slice(0, half)
    : null;
}

const chunkPath = (chunk: string) =>
  lineValue(chunk, "+++ b/") ?? lineValue(chunk, "rename to ") ?? lineValue(chunk, "--- a/") ?? headerPath(chunk);

export function splitPatch(repo: string, unified: string): FileDiffEntry[] {
  return unified
    .split(/^(?=diff --git )/m)
    .filter((chunk) => chunk.startsWith("diff --git "))
    .flatMap((chunk) => {
      const path = chunkPath(chunk);
      return path ? [{ repo, path, patch: chunk }] : [];
    });
}

export async function featureDiff(root: string, feature: string, run: Exec): Promise<{ files: FileDiffEntry[]; errors: RepoDiffError[] }> {
  const status = await ivarJson(root, ["feature", "status", "--", feature], run, featureStatus);
  const results = await Promise.all(
    status.repos.flatMap((r) => (r.worktree_present && r.base ? [{ ...r, base: r.base }] : [])).map(async (r) => {
      try {
        const base = (await checked(run, "git", ["merge-base", r.base, "HEAD"], r.worktree)).trim();
        const tracked = splitPatch(r.repo, await checked(run, "git", [...GIT_DIFF, base], r.worktree));
        return { files: [...tracked, ...(await untrackedDiff(r.repo, r.worktree, run))], errors: [] };
      } catch (e) {
        return { files: [], errors: [{ repo: r.repo, message: (e as Error).message }] };
      }
    }),
  );
  return { files: results.flatMap((r) => r.files), errors: results.flatMap((r) => r.errors) };
}

async function untrackedDiff(repo: string, worktree: string, run: Exec): Promise<FileDiffEntry[]> {
  const listed = await checked(run, "git", ["ls-files", "--others", "--exclude-standard", "-z"], worktree);
  const patches = await Promise.all(
    listed.split("\0").filter(Boolean).map(async (path) => {
      const patch = await checked(run, "git", [...GIT_DIFF, "--no-index", "--", "/dev/null", path], worktree, [0, 1]);
      return patch ? { repo, path, patch } : null;
    }),
  );
  return patches.filter((p): p is FileDiffEntry => p !== null);
}
