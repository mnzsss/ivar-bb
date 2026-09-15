export type PanelRoute = { projectId: string | null; feature: string | null };

export function pickProject(
  projects: ReadonlyArray<{ id: string; isPersonal: boolean }>,
  preferredId: string | null,
): string | null {
  if (preferredId && projects.some((p) => p.id === preferredId)) return preferredId;
  return (projects.find((p) => !p.isPersonal) ?? projects[0])?.id ?? null;
}

export function parsePanelRoute(subPath: string): PanelRoute {
  const [project, section, feature] = subPath.split("/");
  return {
    projectId: project ? decodeURIComponent(project) : null,
    feature: section === "features" && feature ? decodeURIComponent(feature) : null,
  };
}
