import {
  definePluginApp,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  type PluginNavPanelProps,
} from "@get-bb/plugin-sdk/app";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <p className="p-4 text-sm text-muted-foreground">
        {status === "loading" ? "Loading…" : "No project available for an ivar hall."}
      </p>
    );
  const selectProject = (id: string) =>
    navigate.toPluginPanel("ivar", { subPath: encodeURIComponent(id) });

  return (
    <div data-ivar-scroll-root className="min-h-0 flex-1 overflow-auto">
      {!route.feature && projects.length > 1 && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">Project</span>
          <Select value={projectId} onValueChange={selectProject}>
            <SelectTrigger className="h-8 w-56 text-xs" aria-label="Project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
