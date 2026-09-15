import type { FileDiffEntry } from "../diff.js";
import type { ReviewComment } from "../comments.js";

export function groupByRepo(files: FileDiffEntry[]) {
  const groups = new Map<string, FileDiffEntry[]>();
  for (const f of files) groups.set(f.repo, [...(groups.get(f.repo) ?? []), f]);
  return [...groups].map(([repo, files]) => ({ repo, files }));
}

export const toAnnotations = (file: FileDiffEntry, comments: ReviewComment[]) =>
  comments
    .filter((c) => c.repo === file.repo && c.file === file.path)
    .map((c) => ({ side: "additions" as const, lineNumber: c.line_end, metadata: c }));

export const toCommentRange = (selection: { start: number; end: number } | null) =>
  selection && { start: Math.min(selection.start, selection.end), end: Math.max(selection.start, selection.end) };
