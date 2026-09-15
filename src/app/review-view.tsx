import { useCallback, useState } from "react";
import { useBbNavigate, useRpc } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { FileDiffEntry, RepoDiffError } from "../diff.js";
import type { ReviewComment } from "../schemas.js";
import { IvarFileDiff } from "./file-diff.js";
import { groupByRepo } from "./review-model.js";
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

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => navigate.toPluginPanel("ivar", { subPath: encodeURIComponent(projectId) })}>Back</button>
        <h2 style={{ margin: 0, flex: 1 }}>{feature}</h2>
        <button onClick={() => setView(view === "unified" ? "split" : "unified")}>
          {view === "unified" ? "Split" : "Unified"}
        </button>
        <button disabled={openCount === 0} onClick={send}>Send {openCount} open comments to bb threads</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {threads.length > 0 && (
        <ul>
          {threads.map((t) => (
            <li key={t.threadId}>
              <button onClick={() => navigate.toThread(t.threadId)}>{t.repo} thread</button>
            </li>
          ))}
        </ul>
      )}
      {repoErrors.map((e) => <p key={e.repo} role="alert">{e.repo}: {e.message}</p>)}
      {files.length === 0 && repoErrors.length === 0 && <p>No changes.</p>}
      {groupByRepo(files).map((group) => (
        <section key={group.repo}>
          <h3 style={{ position: "sticky", top: 0, margin: 0, padding: "4px 0", background: "inherit" }}>{group.repo}</h3>
          {group.files.map((file) => (
            <IvarFileDiff
              key={file.path}
              file={file}
              view={view}
              comments={comments}
              onAdd={(range, body) => void addComment(file, range, body)}
              onResolve={(id) => void resolve(id)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
