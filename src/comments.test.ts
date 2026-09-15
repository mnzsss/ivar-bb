import { describe, expect, it } from "vitest";
import { addComment, buildThreadPrompt, sendToThreads, type ReviewComment } from "./comments";
import type { Exec } from "./hall";

const open = (id: string, repo: string): ReviewComment => ({ id, repo, file: "src/a.ts", line_start: 3, line_end: 5, body: `fix ${id}`, status: "open" });

describe("addComment", () => {
  it("shells out to ivar with a lines range and parses the json comment", async () => {
    let seen: string[] = [];
    const run: Exec = async (_c, args) => { seen = args; return { code: 0, stderr: "", stdout: JSON.stringify(open("c1", "api")) }; };
    const c = await addComment("/h", "checkout", { repo: "api", file: "src/a.ts", lineStart: 3, lineEnd: 5, body: "fix c1" }, run);
    expect(seen).toEqual(["review", "comment", "add", "checkout", "--repo", "api", "--file", "src/a.ts", "--lines", "3-5", "--body", "fix c1", "--json"]);
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
    expect(prompt).toContain("ivar review comment resolve checkout c1");
  });
  it("uses the given ivar binary path in resolve commands", () => {
    const prompt = buildThreadPrompt("checkout", "api", [open("c1", "api")], "/abs/path/ivar");
    expect(prompt).toContain("`/abs/path/ivar review comment resolve checkout c1`");
  });
});

describe("sendToThreads", () => {
  it("spawns one thread per repo with open comments, in that repo's worktree", async () => {
    const run: Exec = async (_c, args) => ({ code: 0, stderr: "", stdout: args[0] === "review"
      ? JSON.stringify({ comments: [open("c1", "api"), open("c2", "api"), open("c3", "web")] })
      : JSON.stringify({ repos: [{ repo: "api", worktree: "/h/.ivar/repos/api/checkout" }, { repo: "web", worktree: "/h/.ivar/repos/web/checkout" }] }) });
    const spawned: Array<{ repo: string; worktree: string }> = [];
    const result = await sendToThreads("/h", "checkout", run, async (t) => { spawned.push(t); return { threadId: `t-${t.repo}` }; });
    expect(spawned.map((t) => [t.repo, t.worktree])).toEqual([["api", "/h/.ivar/repos/api/checkout"], ["web", "/h/.ivar/repos/web/checkout"]]);
    expect(result).toEqual([{ repo: "api", threadId: "t-api" }, { repo: "web", threadId: "t-web" }]);
  });
});
