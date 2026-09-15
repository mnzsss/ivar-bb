import type { SelectedLineRange } from "@pierre/diffs";
import type { FileDiffEntry } from "../diff.js";
import type { ReviewComment } from "../schemas.js";

export type CommentRange = { kind: "range"; start: number; end: number; side: "additions" };

export function groupByRepo(files: FileDiffEntry[]) {
  const groups = new Map<string, FileDiffEntry[]>();
  for (const f of files) groups.set(f.repo, [...(groups.get(f.repo) ?? []), f]);
  return [...groups].map(([repo, files]) => ({ repo, files }));
}

export const toAnnotations = (file: FileDiffEntry, comments: ReviewComment[]) =>
  comments
    .filter((c) => c.repo === file.repo && c.file === file.path)
    .map((c) => ({ side: "additions" as const, lineNumber: c.line_end, metadata: c }));

export function toCommentRange(selection: SelectedLineRange | null): CommentRange | { kind: "rejected" } | null {
  if (!selection) return null;
  if (selection.side === "deletions" || (selection.endSide ?? selection.side) === "deletions") return { kind: "rejected" };
  return { kind: "range", start: Math.min(selection.start, selection.end), end: Math.max(selection.start, selection.end), side: "additions" };
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function toggleKey(keys: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(keys);
  if (!next.delete(key)) next.add(key);
  return next;
}

export function countChanges(patch: string) {
  const body = patch.slice(Math.max(0, patch.indexOf("\n@@")));
  let additions = 0;
  let deletions = 0;
  for (const line of body.split("\n")) {
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }
  return { additions, deletions };
}
