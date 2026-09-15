import { memo, useCallback, useMemo, useState } from "react";
import { FileDiff } from "@pierre/diffs/react";
import { parsePatchFiles, type DiffLineAnnotation, type SelectedLineRange } from "@pierre/diffs";
import type { FileDiffEntry } from "../diff.js";
import type { ReviewComment } from "../schemas.js";
import {
  countChanges,
  estimatedDiffHeight,
  fileKey,
  toAnnotations,
  toCommentRange,
  type CommentRange,
} from "./review-model.js";
import { buttonClass, mutedTextClass, primaryButtonClass } from "./ui.js";
import { useNearViewport } from "./use-near-viewport.js";

function CommentCard({
  comment,
  onResolve,
}: {
  comment: ReviewComment;
  onResolve(id: string): void;
}) {
  const resolved = comment.status === "resolved";
  return (
    <div
      className={`m-2 flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-xs ${resolved ? "opacity-60" : ""}`}
    >
      <p className="m-0 min-w-0 flex-1 whitespace-pre-wrap">
        {resolved && (
          <span className={`${mutedTextClass} mr-2`}>
            Resolved · L{comment.line_start}–{comment.line_end}
          </span>
        )}
        {comment.body}
      </p>
      {!resolved && (
        <button className={buttonClass} onClick={() => onResolve(comment.id)}>
          Resolve
        </button>
      )}
    </div>
  );
}

function CommentForm({ onSubmit, onCancel }: { onSubmit(body: string): void; onCancel(): void }) {
  const [body, setBody] = useState("");
  return (
    <form
      className="m-2 flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSubmit(body.trim());
      }}
    >
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] p-2 text-xs text-[var(--foreground)]"
      />
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          Comment
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type IvarFileDiffProps = {
  file: FileDiffEntry;
  view: "unified" | "split";
  comments: ReviewComment[];
  collapsed: boolean;
  rejected: boolean;
  onToggle(key: string): void;
  onSelection(key: string, rejected: boolean): void;
  onAdd(file: FileDiffEntry, range: CommentRange, body: string): void;
  onResolve(id: string): void;
};

export const IvarFileDiff = memo(function IvarFileDiff({
  file,
  view,
  comments,
  collapsed,
  rejected,
  onToggle,
  onSelection,
  onAdd,
  onResolve,
}: IvarFileDiffProps) {
  const key = fileKey(file);
  const [range, setRange] = useState<CommentRange | null>(null);
  const options = useMemo(
    () => ({
      diffStyle: view,
      disableFileHeader: true,
      enableLineSelection: true,
      onLineSelected: (r: SelectedLineRange | null) => {
        const selection = toCommentRange(r);
        onSelection(key, selection?.kind === "rejected");
        setRange(selection?.kind === "range" ? selection : null);
      },
    }),
    [view, key, onSelection],
  );
  const lineAnnotations = useMemo(
    () => [
      ...toAnnotations(file, comments),
      ...(range ? [{ side: range.side, lineNumber: range.end, metadata: null }] : []),
    ],
    [file, comments, range],
  );
  const renderAnnotation = useCallback(
    (a: DiffLineAnnotation<ReviewComment | null>) =>
      a.metadata ? (
        <CommentCard comment={a.metadata} onResolve={onResolve} />
      ) : range ? (
        <CommentForm
          onSubmit={(body) => {
            onAdd(file, range, body);
            setRange(null);
          }}
          onCancel={() => setRange(null)}
        />
      ) : null,
    [file, range, onAdd, onResolve],
  );
  const fileDiff = useMemo(
    () => parsePatchFiles(file.patch, undefined, false)[0]?.files[0],
    [file.patch],
  );
  const changes = useMemo(() => countChanges(file.patch), [file.patch]);
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const placeholderHeight = useMemo(() => estimatedDiffHeight(file.patch), [file.patch]);

  return (
    <div ref={nearRef} className="overflow-hidden rounded-md border border-[var(--border)]">
      <div className="flex items-center gap-2 bg-[var(--muted)] px-2 py-1 text-xs">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 bg-transparent text-left text-[var(--foreground)]"
          aria-expanded={!collapsed}
          onClick={() => onToggle(key)}
        >
          <span className="w-3 text-[var(--muted-foreground)]">{collapsed ? "▸" : "▾"}</span>
          <span className="truncate font-mono">{file.path}</span>
          <span className="text-[var(--diff-added)]">+{changes.additions}</span>
          <span className="text-[var(--diff-removed)]">−{changes.deletions}</span>
        </button>
        {rejected && (
          <span role="status" className="text-[var(--warning-text)]">
            Comment on added or unchanged lines only
          </span>
        )}
        <span className={mutedTextClass}>{file.repo}</span>
      </div>
      {collapsed ? null : !near ? (
        <div aria-hidden style={{ height: placeholderHeight }} />
      ) : !fileDiff ? (
        <pre className="m-0 overflow-auto p-2 text-xs">{file.patch}</pre>
      ) : (
        <FileDiff<ReviewComment | null, undefined>
          fileDiff={fileDiff}
          options={options}
          selectedLines={range}
          lineAnnotations={lineAnnotations}
          renderAnnotation={renderAnnotation}
        />
      )}
    </div>
  );
});
