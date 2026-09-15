import { useCallback, useState } from "react";
import { useBbContext, useRpc, type PluginNavPanelProps } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { ReviewComment } from "../schemas.js";
import { parsePanelRoute } from "./panel-route.js";
import { reuseIfEqual } from "./review-model.js";
import { usePolling } from "./use-polling.js";

export function CommentsTab({ subPath }: PluginNavPanelProps) {
  const rpc = useRpc<typeof ivarRpcContract>();
  const context = useBbContext();
  const route = parsePanelRoute(subPath);
  const projectId = route.projectId ?? context.projectId;
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !route.feature) return;
    await rpc.call("comments.list", { projectId, feature: route.feature }).then(
      (r) => {
        setComments((previous) => reuseIfEqual(previous, r.comments));
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [rpc, projectId, route.feature]);
  usePolling(load, 2000);

  if (!projectId || !route.feature)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Open a feature review to see its comments.
      </p>
    );
  const open = comments.filter((c) => c.status === "open");
  return (
    <div className="flex flex-col gap-2 p-3 text-sm text-foreground">
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {open.length === 0 ? (
        <p className="m-0 text-muted-foreground">No open comments on {route.feature}.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {open.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-2">
              <code className="text-xs text-muted-foreground">
                {c.repo}:{c.file}:{c.line_start}-{c.line_end}
              </code>
              <p className="m-0 mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
