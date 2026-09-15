import type { HallView } from "../hall.js";

export type HallSummary = {
  title: string;
  empty?: string;
  repos: string[];
  features: Array<{ name: string; promoted: string[]; href: string }>;
};

export function hallSummary(hall: HallView): HallSummary {
  if (hall.status === "no-hall")
    return {
      title: "ivar",
      empty: "No ivar.json found above this project.",
      repos: [],
      features: [],
    };
  if (hall.status === "ivar-missing")
    return {
      title: "ivar",
      empty: "The ivar binary is not on the bb server PATH.",
      repos: [],
      features: [],
    };
  return {
    title: hall.root,
    repos: hall.repos,
    features: hall.features.map((f) => ({ ...f, href: `features/${f.name}` })),
  };
}
