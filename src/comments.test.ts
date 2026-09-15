import { describe, expect, it } from "vitest";
import { addComment, buildThreadPrompt, sendToThreads } from "./comments";
import type { Exec } from "./exec";
import type { ReviewComment } from "./schemas";

const open = (id: string, repo: string): ReviewComment => ({ id, repo, file: "src/a.ts", line_start: 3, line_end: 5, body: `fix ${id}`, status: "open" });

describe("addComment", () => {
  it("passes values in --flag=value form and the feature after --", async () => {
    let seen: string[] = [];
    const run: Exec = async (_c, args) => { seen = args; return { code: 0, stderr: "", stdout: JSON.stringify(open("c1", "api")) }; };
    const c = await addComment("/h", "checkout", { repo: "api", file: "src/a.ts", lineStart: 3, lineEnd: 5, body: "- starts with a dash" }, run);
    expect(seen).toEqual(["--json", "review", "comment", "add", "--repo=api", "--file=src/a.ts", "--lines=3-5", "--body=- starts with a dash", "--", "checkout"]);
    expect(c.id).toBe("c1");
  });
  it("throws the ivar stderr on failure", async () => {
    const run: Exec = async () => ({ code: 1, stdout: "", stderr: "feature `x` does not exist" });
    await expect(addComment("/h", "x", { repo: "api", file: "a", lineStart: 1, lineEnd: 1, body: "b" }, run)).rejects.toThrow("does not exist");
  });
});

describe("buildThreadPrompt", () => {
  it("lists each comment with its file range and how to resolve it", () => {
    const prompt = buildThreadPrompt("checkout", "api", [open("c1", "api")]);
    expect(prompt).toContain("src/a.ts:3-5");
    expect(prompt).toContain("fix c1");
    expect(prompt).toContain("'ivar' review comment resolve -- checkout c1");
  });
  it("uses the given ivar binary path in resolve commands", () => {
    const prompt = buildThreadPrompt("checkout", "api", [open("c1", "api")], "/abs/path/ivar");
    expect(prompt).toContain("`'/abs/path/ivar' review comment resolve -- checkout c1`");
  });
  it("single-quotes a binary path containing a space", () => {
    const prompt = buildThreadPrompt("checkout", "api", [open("c1", "api")], "/abs/path with space/ivar");
    expect(prompt).toContain("`'/abs/path with space/ivar' review comment resolve -- checkout c1`");
  });
  it("escapes an embedded single quote in the binary path", () => {
    const prompt = buildThreadPrompt("checkout", "api", [open("c1", "api")], "/abs/o'brien/ivar");
    expect(prompt).toContain(`'/abs/o'\\''brien/ivar'`);
  });
});

describe("sendToThreads", () => {
  it("spawns one thread per repo with open comments, in that repo's worktree", async () => {
    const repo = (name: string) => ({ repo: name, worktree: `/h/.ivar/repos/${name}/checkout`, base: "main", worktree_present: true, state: "ready" });
    const run: Exec = async (_c, args) => ({ code: 0, stderr: "", stdout: args[1] === "review"
      ? JSON.stringify({ comments: [open("c1", "api"), open("c2", "api"), open("c3", "web")] })
      : JSON.stringify({ repos: [repo("api"), repo("web")] }) });
    const spawned: Array<{ repo: string; worktree: string }> = [];
    const result = await sendToThreads("/h", "checkout", run, async (t) => { spawned.push(t); return { threadId: `t-${t.repo}` }; });
    expect(spawned.map((t) => [t.repo, t.worktree])).toEqual([["api", "/h/.ivar/repos/api/checkout"], ["web", "/h/.ivar/repos/web/checkout"]]);
    expect(result).toEqual([{ repo: "api", threadId: "t-api" }, { repo: "web", threadId: "t-web" }]);
  });
});
