import { describe, expect, it } from "vitest";
import type { Exec } from "./exec";
import { findHallRoot, getHall, hallCommandArgs, runIvar } from "./hall";

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
  it("combines repo list and feature list, reading promotions from the list", async () => {
    const calls: string[][] = [];
    const run: Exec = async (_cmd, args) => {
      calls.push(args);
      const out: Record<string, unknown> = {
        "--json repo list": { repos: [{ name: "api", url: "u" }, { name: "web" }] },
        "--json feature list": { features: [{ name: "checkout", repos: ["api"], state: "active" }] },
      };
      return { code: 0, stdout: JSON.stringify(out[args.join(" ")]), stderr: "" };
    };
    const hall = await getHall("/h", run, existsIn(["/h/ivar.json"]));
    expect(hall).toEqual({ status: "ok", root: "/h", repos: ["api", "web"], features: [{ name: "checkout", promoted: ["api"] }] });
    expect(calls).toHaveLength(2);
  });
  it("throws the ivar error when a listing fails", async () => {
    const run: Exec = async (_c, args) => args.includes("feature")
      ? { code: 2, stdout: "", stderr: "manifest is invalid" }
      : { code: 0, stdout: JSON.stringify({ repos: [] }), stderr: "" };
    await expect(getHall("/h", run, existsIn(["/h/ivar.json"]))).rejects.toThrow("manifest is invalid");
  });
  it("throws when ivar output does not match the expected shape", async () => {
    const run: Exec = async () => ({ code: 0, stdout: JSON.stringify({ nope: true }), stderr: "" });
    await expect(getHall("/h", run, existsIn(["/h/ivar.json"]))).rejects.toThrow();
  });
});

describe("hallCommandArgs", () => {
  it("builds argv per command with -- before user-supplied positionals", () => {
    expect(hallCommandArgs({ command: "sync" })).toEqual(["sync"]);
    expect(hallCommandArgs({ command: "feature create", name: "--base=evil" })).toEqual(["feature", "create", "--", "--base=evil"]);
    expect(hallCommandArgs({ command: "promote", feature: "checkout", repo: "api" })).toEqual(["feature", "promote", "checkout", "api"]);
  });
  it("refuses flag-like promote values since promote cannot take --", () => {
    expect(() => hallCommandArgs({ command: "promote", feature: "checkout", repo: "--base=x" })).toThrow('must not start with "-"');
  });
});

describe("runIvar", () => {
  it("runs the built argv in the hall root", async () => {
    const seen: Array<[string, string[], string]> = [];
    const run: Exec = async (c, args, cwd) => { seen.push([c, args, cwd]); return { code: 0, stdout: "", stderr: "" }; };
    await runIvar("/h", { command: "promote", feature: "checkout", repo: "api; rm -rf /" }, run);
    expect(seen).toEqual([["ivar", ["feature", "promote", "checkout", "api; rm -rf /"], "/h"]]);
  });
});
