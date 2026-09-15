import { definePluginApp, useBbContext } from "@get-bb/plugin-sdk/app";
import { HallView } from "./src/app/hall-view.js";

function IvarPanel() {
  const { projectId } = useBbContext();
  if (!projectId) return <div style={{ padding: 16 }}>Select a project to see its ivar hall.</div>;
  return <HallView projectId={projectId} />;
}

export default definePluginApp((app) =>
  app.slots.navPanel({ id: "ivar", title: "ivar", icon: "Network", path: "ivar", component: IvarPanel }),
);
