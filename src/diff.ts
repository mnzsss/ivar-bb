import * as nodeFs from "node:fs/promises";
import { join } from "node:path";
import { checked, ivarJson, type Exec } from "./exec.js";
import { featureStatus, type FileDiffEntry, type RepoDiffError } from "./schemas.js";

export type { FileDiffEntry, RepoDiffError } from "./schemas.js";

export type UntrackedFs = {
  lstat(
    path: string,
  ): Promise<{ isDirectory(): boolean; isSymbolicLink(): boolean; size: number; mode: number }>;
  readFile(path: string): Promise<Buffer>;
  readlink(path: string): Promise<string>;
};
export type NewFileMode = "100644" | "100755" | "120000";
export const UNTRACKED_MAX_BYTES = 1024 * 1024;

const GIT_DIFF = [
  "-c",
  "core.quotePath=false",
  "diff",
  "--no-color",
  "--no-ext-diff",
  "--src-prefix=a/",
  "--dst-prefix=b/",
];

function lineValue(chunk: string, prefix: string): string | null {
  const line = chunk.split("\n").find((l) => l.startsWith(prefix));
  return line ? line.slice(prefix.length).replace(/\t$/, "") : null;
}

function headerPath(chunk: string): string | null {
  const rest = chunk.slice(
    "diff --git a/".length,
    chunk.indexOf("\n") === -1 ? undefined : chunk.indexOf("\n"),
  );
  const half = (rest.length - 3) / 2;
  return Number.isInteger(half) &&
    half > 0 &&
    rest.slice(half, half + 3) === " b/" &&
    rest.slice(0, half) === rest.slice(half + 3)
    ? rest.slice(0, half)
    : null;
}

const chunkPath = (chunk: string) =>
  lineValue(chunk, "+++ b/") ??
  lineValue(chunk, "rename to ") ??
  lineValue(chunk, "--- a/") ??
  headerPath(chunk);

export function splitPatch(repo: string, unified: string): FileDiffEntry[] {
  return unified
    .split(/^(?=diff --git )/m)
    .filter((chunk) => chunk.startsWith("diff --git "))
    .flatMap((chunk) => {
      const path = chunkPath(chunk);
      return path ? [{ repo, path, patch: chunk }] : [];
    });
}

export function untrackedPatch(
  path: string,
  content: Buffer | "binary",
  mode: NewFileMode = "100644",
): string {
  const header = `diff --git a/${path} b/${path}\nnew file mode ${mode}\n`;
  if (content === "binary" || content.length > UNTRACKED_MAX_BYTES || content.includes(0))
    return `${header}Binary files /dev/null and b/${path} differ\n`;
  if (content.length === 0) return header;
  const text = content.toString("utf8");
  const endsWithNewline = text.endsWith("\n");
  const lines = (endsWithNewline ? text.slice(0, -1) : text).split("\n");
  const range = lines.length === 1 ? "1" : `1,${lines.length}`;
  return (
    `${header}--- /dev/null\n+++ b/${path}\n@@ -0,0 +${range} @@\n` +
    lines.map((line) => `+${line}\n`).join("") +
    (endsWithNewline ? "" : "\\ No newline at end of file\n")
  );
}

export async function featureDiff(
  root: string,
  feature: string,
  run: Exec,
  fs: UntrackedFs = nodeFs,
): Promise<{ files: FileDiffEntry[]; errors: RepoDiffError[] }> {
  const status = await ivarJson(root, ["feature", "status", "--", feature], run, featureStatus);
  const results = await Promise.all(
    status.repos
      .flatMap((r) => (r.worktree_present && r.base ? [{ ...r, base: r.base }] : []))
      .map(async (r) => {
        try {
          const base = (
            await checked(run, "git", ["merge-base", r.base, "HEAD"], r.worktree)
          ).trim();
          const tracked = splitPatch(
            r.repo,
            await checked(run, "git", [...GIT_DIFF, base], r.worktree),
          );
          return {
            files: [...tracked, ...(await untrackedDiff(r.repo, r.worktree, run, fs))],
            errors: [],
          };
        } catch (e) {
          return { files: [], errors: [{ repo: r.repo, message: (e as Error).message }] };
        }
      }),
  );
  return { files: results.flatMap((r) => r.files), errors: results.flatMap((r) => r.errors) };
}

async function untrackedDiff(
  repo: string,
  worktree: string,
  run: Exec,
  fs: UntrackedFs,
): Promise<FileDiffEntry[]> {
  const listed = await checked(
    run,
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    worktree,
  );
  const entries = await Promise.all(
    listed
      .split("\0")
      .filter((path) => path && !path.endsWith("/"))
      .map(async (path) => {
        const patch = await skipMissing(untrackedEntryPatch(path, join(worktree, path), fs));
        return patch === null ? [] : [{ repo, path, patch }];
      }),
  );
  return entries.flat();
}

async function untrackedEntryPatch(
  path: string,
  absolute: string,
  fs: UntrackedFs,
): Promise<string | null> {
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink())
    return untrackedPatch(path, Buffer.from(await fs.readlink(absolute)), "120000");
  if (stat.isDirectory()) return null;
  const mode = stat.mode & 0o111 ? "100755" : "100644";
  if (stat.size > UNTRACKED_MAX_BYTES) return untrackedPatch(path, "binary", mode);
  return untrackedPatch(path, await fs.readFile(absolute), mode);
}

async function skipMissing(patch: Promise<string | null>): Promise<string | null> {
  try {
    return await patch;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
