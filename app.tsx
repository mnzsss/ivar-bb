import { definePluginApp, useBbContext, type PluginNavPanelProps } from "@get-bb/plugin-sdk/app";
import { HallView } from "./src/app/hall-view.js";
import { ReviewView } from "./src/app/review-view.js";

function IvarPanel({ subPath }: PluginNavPanelProps) {
  const { projectId } = useBbContext();
  if (!projectId) return <div style={{ padding: 16 }}>Select a project to see its ivar hall.</div>;
  const feature = /^features\/([^/]+)$/.exec(subPath)?.[1];
  if (feature) return <ReviewView projectId={projectId} feature={decodeURIComponent(feature)} />;
  return <HallView projectId={projectId} />;
}

export default definePluginApp((app) =>
  app.slots.navPanel({ id: "ivar", title: "ivar", icon: "Network", path: "ivar", component: IvarPanel }),
);
