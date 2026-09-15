import { useMemo, useState } from "react";
import { FileDiff } from "@pierre/diffs/react";
import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffEntry } from "../diff.js";
import type { ReviewComment } from "../comments.js";
import { toAnnotations } from "./review-model.js";

type LineRange = { start: number; end: number };

function CommentCard({ comment, onResolve }: { comment: ReviewComment; onResolve(id: string): void }) {
  if (comment.status === "resolved") {
    return (
      <details style={{ padding: 8, opacity: 0.6 }}>
        <summary>Resolved comment (lines {comment.line_start}–{comment.line_end})</summary>
        <p style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
      </details>
    );
  }
  return (
    <div style={{ padding: 8, border: "1px solid currentColor", borderRadius: 6 }}>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{comment.body}</p>
      <button onClick={() => onResolve(comment.id)}>Resolve</button>
    </div>
  );
}

function CommentForm({ onSubmit, onCancel }: { onSubmit(body: string): void; onCancel(): void }) {
  const [body, setBody] = useState("");
  return (
    <form
      style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSubmit(body.trim());
      }}
    >
      <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
      <div>
        <button type="submit">Submit</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function IvarFileDiff({ file, view, comments, onAdd, onResolve }: {
  file: FileDiffEntry;
  view: "unified" | "split";
  comments: ReviewComment[];
  onAdd(range: LineRange, body: string): void;
  onResolve(id: string): void;
}) {
  const [range, setRange] = useState<LineRange | null>(null);
  const fileDiff = useMemo(() => parsePatchFiles(file.patch, undefined, false)[0]?.files[0], [file.patch]);
  if (!fileDiff) return <pre>{file.patch}</pre>;
  return (
    <FileDiff<ReviewComment | null, undefined>
      fileDiff={fileDiff}
      options={{
        diffStyle: view,
        enableLineSelection: true,
        onLineSelected: (r) => setRange(r ? { start: Math.min(r.start, r.end), end: Math.max(r.start, r.end) } : null),
      }}
      lineAnnotations={[
        ...toAnnotations(file, comments),
        ...(range ? [{ side: "additions" as const, lineNumber: range.end, metadata: null }] : []),
      ]}
      renderAnnotation={(a) =>
        a.metadata ? (
          <CommentCard comment={a.metadata} onResolve={onResolve} />
        ) : range ? (
          <CommentForm onSubmit={(body) => { onAdd(range, body); setRange(null); }} onCancel={() => setRange(null)} />
        ) : null
      }
    />
  );
}
