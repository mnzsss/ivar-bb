import {
  definePluginApp,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  type PluginNavPanelProps,
} from "@get-bb/plugin-sdk/app";
import { HallView } from "./src/app/hall-view.js";
import { parsePanelRoute, pickProject } from "./src/app/panel-route.js";
import { ReviewView } from "./src/app/review-view.js";
import { CommentsTab } from "./src/app/comments-tab.js";

function IvarPanel({ subPath }: PluginNavPanelProps) {
  const context = useBbContext();
  const { status, projects } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const route = parsePanelRoute(subPath);
  const projectId = pickProject(projects, route.projectId ?? context.projectId);

  if (!projectId)
    return (
      <div style={{ padding: 16 }}>
        {status === "loading" ? "Loading…" : "No project available for an ivar hall."}
      </div>
    );
  const selectProject = (id: string) =>
    navigate.toPluginPanel("ivar", { subPath: encodeURIComponent(id) });

  return (
    <div data-ivar-scroll-root className="min-h-0 flex-1 overflow-auto">
      {!route.feature && projects.length > 1 && (
        <label style={{ display: "block", padding: "16px 16px 0" }}>
          Project{" "}
          <select value={projectId} onChange={(e) => selectProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {route.feature ? (
        <ReviewView projectId={projectId} feature={route.feature} />
      ) : (
        <HallView projectId={projectId} />
      )}
    </div>
  );
}

export default definePluginApp((app) =>
  app.slots.navPanel({
    id: "ivar",
    title: "ivar",
    icon: "Network",
    path: "ivar",
    component: IvarPanel,
    fixedTabs: [
      {
        panelId: "ivar",
        id: "comments",
        title: "Review comments",
        icon: "MessageSquare",
        component: CommentsTab,
      },
    ],
  }),
);
