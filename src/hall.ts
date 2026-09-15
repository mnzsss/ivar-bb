import path from "node:path";
import { checkedStdout, ivarJson, parseIvarJson, type Exec } from "./exec.js";
import { featureList, repoList, type HallView } from "./schemas.js";

export type { HallView } from "./schemas.js";

export type HallCommand =
  | { command: "sync" }
  | { command: "feature create"; name: string }
  | { command: "promote"; feature: string; repo: string };

export async function findHallRoot(start: string, exists: (p: string) => Promise<boolean>): Promise<string | null> {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (await exists(path.join(dir, "ivar.json"))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

export async function getHall(start: string, run: Exec, exists: (p: string) => Promise<boolean>): Promise<HallView> {
  const root = await findHallRoot(start, exists);
  if (!root) return { status: "no-hall" };
  const repoArgs = ["--json", "repo", "list"];
  const repoResult = await run("ivar", repoArgs, root);
  if (repoResult.code === 127) return { status: "ivar-missing" };
  const repos = parseIvarJson(checkedStdout(repoResult, "ivar", repoArgs), repoList).repos.map((r) => r.name);
  const { features } = await ivarJson(root, ["feature", "list"], run, featureList);
  return { status: "ok", root, repos, features: features.map((f) => ({ name: f.name, promoted: f.repos })) };
}

function positional(value: string): string {
  if (value.startsWith("-")) throw new Error(`"${value}" must not start with "-"`);
  return value;
}

export function hallCommandArgs(input: HallCommand): string[] {
  switch (input.command) {
    case "sync":
      return ["sync"];
    case "feature create":
      return ["feature", "create", "--", input.name];
    case "promote":
      // `ivar feature promote -- <feature> <repo>` is rejected by clap (optional [FEATURE] before <REPO>), so refuse flag-like values instead.
      return ["feature", "promote", positional(input.feature), positional(input.repo)];
  }
}

export const runIvar = (root: string, input: HallCommand, run: Exec) => run("ivar", hallCommandArgs(input), root);
