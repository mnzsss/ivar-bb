import { describe, expect, it } from "vitest";
import { findHallRoot, getHall, runIvar, type Exec } from "./hall";

const existsIn = (files: string[]) => async (p: string) => files.includes(p);

describe("findHallRoot", () => {
  it("walks up to the nearest ivar.json", async () => {
    expect(await findHallRoot("/h/.ivar/repos/api/main/src", existsIn(["/h/ivar.json"]))).toBe("/h");
  });
  it("returns null when no ancestor has ivar.json", async () => {
    expect(await findHallRoot("/x/y", existsIn([]))).toBeNull();
  });
});

describe("getHall", () => {
  it("reports ivar-missing when the binary cannot be spawned", async () => {
    const run: Exec = async () => ({ code: 127, stdout: "", stderr: "ENOENT" });
    expect(await getHall("/h", run, existsIn(["/h/ivar.json"]))).toEqual({ status: "ivar-missing" });
  });
  it("combines repo list, feature list and per-feature status", async () => {
    const calls: string[][] = [];
    const run: Exec = async (_cmd, args) => {
      calls.push(args);
      const out: Record<string, unknown> = {
        "repo list --json": { repos: [{ name: "api" }] },
        "feature list --json": { features: [{ name: "checkout" }] },
        "feature status checkout --json": { name: "checkout", repos: [{ repo: "api", worktree: "/h/.ivar/repos/api/checkout" }] },
      };
      return { code: 0, stdout: JSON.stringify(out[args.join(" ")] ?? {}), stderr: "" };
    };
    const hall = await getHall("/h", run, existsIn(["/h/ivar.json"]));
    expect(hall).toMatchObject({ status: "ok", root: "/h", repos: [{ name: "api" }], features: [{ name: "checkout" }] });
    expect(calls).toContainEqual(["feature", "status", "checkout", "--json"]);
  });
});

describe("runIvar", () => {
  it("passes arguments as an array and rejects commands outside the allowlist", async () => {
    const seen: string[][] = [];
    const run: Exec = async (_c, args) => { seen.push(args); return { code: 0, stdout: "", stderr: "" }; };
    await runIvar("/h", "promote", ["checkout", "api; rm -rf /"], run);
    expect(seen[0]).toEqual(["promote", "checkout", "api; rm -rf /"]);
    await expect(runIvar("/h", "deliver" as never, [], run)).rejects.toThrow("not allowed");
  });
});
