import { useCallback, useState } from "react";
import { useBbNavigate, useRpc } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { FileDiffEntry, RepoDiffError } from "../diff.js";
import type { ReviewComment } from "../schemas.js";
import { IvarFileDiff } from "./file-diff.js";
import { groupByRepo, toggleKey } from "./review-model.js";
import { buttonClass, mutedTextClass, primaryButtonClass } from "./ui.js";
import { usePolling } from "./use-polling.js";

export function ReviewView({ projectId, feature }: { projectId: string; feature: string }) {
  const rpc = useRpc<typeof ivarRpcContract>();
  const navigate = useBbNavigate();
  const [files, setFiles] = useState<FileDiffEntry[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [view, setView] = useState<"unified" | "split">("unified");
  const [threads, setThreads] = useState<Array<{ repo: string; threadId: string }>>([]);
  const [repoErrors, setRepoErrors] = useState<RepoDiffError[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);
  const [rejectedKey, setRejectedKey] = useState<string | null>(null);

  const report = (e: Error) => setError(e.message);
  const refreshDiff = useCallback(
    () => rpc.call("feature.diff", { projectId, feature }).then((r) => { setFiles(r.files); setRepoErrors(r.errors); }, report),
    [rpc, projectId, feature],
  );
  const refreshComments = useCallback(
    () => rpc.call("comments.list", { projectId, feature }).then((r) => { setComments(r.comments); setError(null); }, report),
    [rpc, projectId, feature],
  );
  usePolling(refreshDiff, 5000);
  usePolling(refreshComments, 2000);

  const addComment = (file: FileDiffEntry, range: { start: number; end: number }, body: string) =>
    rpc
      .call("comments.add", { projectId, feature, repo: file.repo, file: file.path, lineStart: range.start, lineEnd: range.end, body })
      .then(refreshComments, report);
  const resolve = (id: string) => rpc.call("comments.resolve", { projectId, feature, id }).then(refreshComments, report);
  const send = () => rpc.call("comments.send", { projectId, feature }).then((r) => setThreads(r.threads), report);

  const openCount = comments.filter((c) => c.status === "open").length;
  const resolvedCount = comments.length - openCount;
  const visibleComments = showResolved ? comments : comments.filter((c) => c.status === "open");
  const keyOf = (file: FileDiffEntry) => `${file.repo}/${file.path}`;
  const allCollapsed = files.length > 0 && files.every((f) => collapsed.has(keyOf(f)));

  return (
    <div className="flex flex-col text-sm text-[var(--foreground)]">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--background)] px-4 py-2">
        <button className={buttonClass} onClick={() => navigate.toPluginPanel("ivar", { subPath: encodeURIComponent(projectId) })}>← Back</button>
        <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold">
          {feature} <span className={`${mutedTextClass} font-normal`}>{files.length} files</span>
        </h2>
        <div className="inline-flex" role="group" aria-label="Diff style">
          {(["unified", "split"] as const).map((style) => (
            <button
              key={style}
              className={`${buttonClass} capitalize first:rounded-r-none last:-ml-px last:rounded-l-none`}
              aria-pressed={view === style}
              onClick={() => setView(style)}
            >
              {style}
            </button>
          ))}
        </div>
        <button
          className={buttonClass}
          disabled={files.length === 0}
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(files.map(keyOf)))}
        >
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
        <button className={buttonClass} aria-pressed={showResolved} disabled={resolvedCount === 0} onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? "Hide" : "Show"} resolved ({resolvedCount})
        </button>
        <button className={primaryButtonClass} disabled={openCount === 0} onClick={send}>Send {openCount} open to bb threads</button>
      </header>
      <div className="flex flex-col gap-4 p-4">
        {error && <p role="alert" className="m-0 text-[var(--destructive-text)]">{error}</p>}
        {threads.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={mutedTextClass}>Threads:</span>
            {threads.map((t) => (
              <button key={t.threadId} className={buttonClass} onClick={() => navigate.toThread(t.threadId)}>{t.repo}</button>
            ))}
          </div>
        )}
        {repoErrors.map((e) => <p key={e.repo} role="alert" className="m-0 text-[var(--destructive-text)]">{e.repo}: {e.message}</p>)}
        {files.length === 0 && repoErrors.length === 0 && <p className={mutedTextClass}>No changes.</p>}
        {groupByRepo(files).map((group) => (
          <section key={group.repo} className="flex flex-col gap-2">
            <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {group.repo} <span className="font-normal">· {group.files.length} files</span>
            </h3>
            {group.files.map((file) => (
              <IvarFileDiff
                key={file.path}
                file={file}
                view={view}
                comments={visibleComments}
                collapsed={collapsed.has(keyOf(file))}
                rejected={rejectedKey === keyOf(file)}
                onToggle={() => setCollapsed((keys) => toggleKey(keys, keyOf(file)))}
                onSelection={(rejected) => setRejectedKey(rejected ? keyOf(file) : null)}
                onAdd={(range, body) => void addComment(file, range, body)}
                onResolve={(id) => void resolve(id)}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
