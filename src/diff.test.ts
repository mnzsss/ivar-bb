import { describe, expect, it } from "vitest";
import { featureDiff, splitPatch } from "./diff";
import type { Exec } from "./hall";

const patch = [
  "diff --git a/src/a.ts b/src/a.ts", "index 1..2 100644", "--- a/src/a.ts", "+++ b/src/a.ts", "@@ -1 +1 @@", "-x", "+y",
  "diff --git a/README.md b/README.md", "new file mode 100644", "--- /dev/null", "+++ b/README.md", "@@ -0,0 +1 @@", "+hi", "",
].join("\n");

describe("splitPatch", () => {
  it("splits a unified diff into one entry per file", () => {
    const files = splitPatch("api", patch);
    expect(files.map((f) => f.path)).toEqual(["src/a.ts", "README.md"]);
    expect(files[0]!.patch.startsWith("diff --git a/src/a.ts")).toBe(true);
    expect(files[0]!.patch).not.toContain("README.md");
  });
});

describe("featureDiff", () => {
  it("diffs each present worktree against its merge-base with the base, including uncommitted changes", async () => {
    const calls: Array<[string, string[], string]> = [];
    const run: Exec = async (cmd, args, cwd) => {
      calls.push([cmd, args, cwd]);
      if (cmd === "ivar") return { code: 0, stderr: "", stdout: JSON.stringify({ repos: [
        { repo: "api", worktree: "/h/.ivar/repos/api/checkout", base: "main", worktree_present: true },
        { repo: "web", worktree: "/h/.ivar/repos/web/checkout", base: "main", worktree_present: false },
      ] }) };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc123\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: patch, stderr: "" };
    };
    const files = await featureDiff("/h", "checkout", run);
    expect(files.map((f) => `${f.repo}:${f.path}`)).toEqual(["api:src/a.ts", "api:README.md"]);
    expect(calls).toContainEqual(["git", ["merge-base", "main", "HEAD"], "/h/.ivar/repos/api/checkout"]);
    expect(calls).toContainEqual(["git", ["diff", "--no-color", "--no-ext-diff", "abc123"], "/h/.ivar/repos/api/checkout"]);
    expect(calls.some(([, , cwd]) => cwd.includes("/web/"))).toBe(false);
  });
  it("includes untracked files as new-file patches", async () => {
    const run: Exec = async (cmd, args) => {
      if (cmd === "ivar") return { code: 0, stderr: "", stdout: JSON.stringify({ repos: [
        { repo: "api", worktree: "/h/.ivar/repos/api/checkout", base: "main", worktree_present: true },
      ] }) };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc123\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "notes/new.md\0", stderr: "" };
      if (args.includes("--no-index")) return { code: 1, stderr: "", stdout: "diff --git a/notes/new.md b/notes/new.md\nnew file mode 100644\n--- /dev/null\n+++ b/notes/new.md\n@@ -0,0 +1 @@\n+hi\n" };
      return { code: 0, stdout: "", stderr: "" };
    };
    const files = await featureDiff("/h", "checkout", run);
    expect(files.map((f) => `${f.repo}:${f.path}`)).toEqual(["api:notes/new.md"]);
    expect(files[0]!.patch.startsWith("diff --git")).toBe(true);
  });
});
