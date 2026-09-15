import type { HallView } from "../hall.js";

export type HallSummary = {
  title: string;
  empty?: string;
  repos: string[];
  features: Array<{ name: string; promoted: string[]; href: string }>;
};

const nameOf = (repo: unknown) => (repo as { name?: string }).name ?? String(repo);

export function hallSummary(hall: HallView): HallSummary {
  if (hall.status === "no-hall") return { title: "ivar", empty: "No ivar.json found above this project.", repos: [], features: [] };
  if (hall.status === "ivar-missing") return { title: "ivar", empty: "The ivar binary is not on the bb server PATH.", repos: [], features: [] };
  return {
    title: hall.root,
    repos: hall.repos.map(nameOf),
    features: hall.features.map((f) => ({
      name: f.name,
      promoted: ((f.status as { repos?: Array<{ repo: string }> } | null)?.repos ?? []).map((r) => r.repo),
      href: `features/${f.name}`,
    })),
  };
}
