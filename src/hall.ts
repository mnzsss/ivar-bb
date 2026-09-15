import path from "node:path";
import type { Exec } from "./exec.js";

export type { Exec } from "./exec.js";

export type FeatureView = { name: string; status: unknown };
export type HallView =
  | { status: "ok"; root: string; repos: unknown[]; features: FeatureView[] }
  | { status: "no-hall" }
  | { status: "ivar-missing" };

export const ALLOWED_COMMANDS = ["sync", "feature create", "promote"] as const;
export type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

export async function findHallRoot(start: string, exists: (p: string) => Promise<boolean>): Promise<string | null> {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (await exists(path.join(dir, "ivar.json"))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

export async function getHall(start: string, run: Exec, exists: (p: string) => Promise<boolean>): Promise<HallView> {
  const root = await findHallRoot(start, exists);
  if (!root) return { status: "no-hall" };
  const repoList = await run("ivar", ["repo", "list", "--json"], root);
  if (repoList.code === 127) return { status: "ivar-missing" };
  const featureList = await run("ivar", ["feature", "list", "--json"], root);
  const repos: unknown[] = JSON.parse(repoList.stdout).repos ?? [];
  const names: Array<{ name: string }> = JSON.parse(featureList.stdout).features ?? [];
  const features = await Promise.all(
    names.map(async ({ name }) => ({
      name,
      status: JSON.parse((await run("ivar", ["feature", "status", name, "--json"], root)).stdout) as unknown,
    })),
  );
  return { status: "ok", root, repos, features };
}

export async function runIvar(root: string, command: AllowedCommand, args: string[], run: Exec) {
  if (!ALLOWED_COMMANDS.includes(command)) throw new Error(`ivar ${command} is not allowed`);
  return run("ivar", [...command.split(" "), ...args], root);
}
