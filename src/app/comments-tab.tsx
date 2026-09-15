import { useCallback, useState } from "react";
import { useBbContext, useRpc, type PluginNavPanelProps } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { ReviewComment } from "../schemas.js";
import { parsePanelRoute } from "./panel-route.js";
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
        setComments(r.comments);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [rpc, projectId, route.feature]);
  usePolling(load, 2000);

  if (!projectId || !route.feature) return <p>Open a feature review to see its comments.</p>;
  const open = comments.filter((c) => c.status === "open");
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {open.length === 0 ? (
        <p>No open comments on {route.feature}.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {open.map((c) => (
            <li key={c.id} style={{ marginBottom: 8 }}>
              <code>
                {c.repo}:{c.file}:{c.line_start}-{c.line_end}
              </code>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
