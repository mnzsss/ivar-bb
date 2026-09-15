import { useEffect, useState } from "react";
import { useBbContext, useRpc, type PluginNavPanelProps } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { ReviewComment } from "../comments.js";
import { parsePanelRoute } from "./panel-route.js";

export function CommentsTab({ subPath }: PluginNavPanelProps) {
  const rpc = useRpc<typeof ivarRpcContract>();
  const context = useBbContext();
  const route = parsePanelRoute(subPath);
  const projectId = route.projectId ?? context.projectId;
  const [comments, setComments] = useState<ReviewComment[]>([]);

  useEffect(() => {
    if (!projectId || !route.feature) return;
    const load = () => rpc.call("comments.list", { projectId, feature: route.feature! }).then((r) => setComments(r.comments), () => {});
    void load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [rpc, projectId, route.feature]);

  if (!projectId || !route.feature) return <p>Open a feature review to see its comments.</p>;
  const open = comments.filter((c) => c.status === "open");
  if (open.length === 0) return <p>No open comments on {route.feature}.</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: 16 }}>
      {open.map((c) => (
        <li key={c.id} style={{ marginBottom: 8 }}>
          <code>{c.repo}:{c.file}:{c.line_start}-{c.line_end}</code>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
