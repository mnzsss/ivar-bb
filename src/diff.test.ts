import { describe, expect, it } from "vitest";
import { featureDiff, splitPatch } from "./diff";
import type { Exec } from "./exec";

const patch = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 1..2 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1 +1 @@",
  "-x",
  "+y",
  "diff --git a/README.md b/README.md",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/README.md",
  "@@ -0,0 +1 @@",
  "+hi",
  "",
].join("\n");

const GIT_DIFF = [
  "-c",
  "core.quotePath=false",
  "diff",
  "--no-color",
  "--no-ext-diff",
  "--src-prefix=a/",
  "--dst-prefix=b/",
];

const status = (...repos: Array<{ repo: string; present?: boolean }>) =>
  JSON.stringify({
    repos: repos.map((r) => ({
      repo: r.repo,
      worktree: `/h/.ivar/repos/${r.repo}/checkout`,
      base: "main",
      worktree_present: r.present ?? true,
      state: "ready",
    })),
  });

describe("splitPatch", () => {
  it("splits a unified diff into one entry per file", () => {
    const files = splitPatch("api", patch);
    expect(files.map((f) => f.path)).toEqual(["src/a.ts", "README.md"]);
    expect(files[0]!.patch.startsWith("diff --git a/src/a.ts")).toBe(true);
    expect(files[0]!.patch).not.toContain("README.md");
  });
  it("reads paths with spaces, dropping git's trailing tab", () => {
    const spaced =
      "diff --git a/x b/y b/x b/y\n--- a/x b/y\t\n+++ b/x b/y\t\n@@ -1 +1 @@\n-a\n+b\n";
    expect(splitPatch("api", spaced).map((f) => f.path)).toEqual(["x b/y"]);
  });
  it("uses the old path for deletions and the header for mode-only changes", () => {
    const chunks =
      "diff --git a/gone.ts b/gone.ts\ndeleted file mode 100644\n--- a/gone.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n" +
      "diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755\n";
    expect(splitPatch("api", chunks).map((f) => f.path)).toEqual(["gone.ts", "run.sh"]);
  });
  it("skips a chunk whose path cannot be read instead of throwing", () => {
    expect(splitPatch("api", 'diff --git "weird"\nBinary files differ\n')).toEqual([]);
  });
});

describe("featureDiff", () => {
  it("diffs each present worktree against its merge-base with the base, including uncommitted changes", async () => {
    const calls: Array<[string, string[], string]> = [];
    const run: Exec = async (cmd, args, cwd) => {
      calls.push([cmd, args, cwd]);
      if (cmd === "ivar")
        return {
          code: 0,
          stderr: "",
          stdout: status({ repo: "api" }, { repo: "web", present: false }),
        };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc123\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: patch, stderr: "" };
    };
    const { files, errors } = await featureDiff("/h", "checkout", run);
    expect(files.map((f) => `${f.repo}:${f.path}`)).toEqual(["api:src/a.ts", "api:README.md"]);
    expect(errors).toEqual([]);
    expect(calls).toContainEqual(["ivar", ["--json", "feature", "status", "--", "checkout"], "/h"]);
    expect(calls).toContainEqual([
      "git",
      ["merge-base", "main", "HEAD"],
      "/h/.ivar/repos/api/checkout",
    ]);
    expect(calls).toContainEqual(["git", [...GIT_DIFF, "abc123"], "/h/.ivar/repos/api/checkout"]);
    expect(calls.some(([, , cwd]) => cwd.includes("/web/"))).toBe(false);
  });
  it("includes untracked files as new-file patches", async () => {
    const run: Exec = async (cmd, args) => {
      if (cmd === "ivar") return { code: 0, stderr: "", stdout: status({ repo: "api" }) };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc123\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "notes/new.md\0", stderr: "" };
      if (args.includes("--no-index"))
        return {
          code: 1,
          stderr: "",
          stdout:
            "diff --git a/notes/new.md b/notes/new.md\nnew file mode 100644\n--- /dev/null\n+++ b/notes/new.md\n@@ -0,0 +1 @@\n+hi\n",
        };
      return { code: 0, stdout: "", stderr: "" };
    };
    const { files } = await featureDiff("/h", "checkout", run);
    expect(files.map((f) => `${f.repo}:${f.path}`)).toEqual(["api:notes/new.md"]);
    expect(files[0]!.patch.startsWith("diff --git")).toBe(true);
  });
  it("reports a failing git command for that repo and keeps the other repos", async () => {
    const run: Exec = async (cmd, args, cwd) => {
      if (cmd === "ivar")
        return { code: 0, stderr: "", stdout: status({ repo: "api" }, { repo: "web" }) };
      if (args[0] === "merge-base")
        return cwd.includes("/web/")
          ? { code: 128, stdout: "", stderr: "fatal: Not a valid object name main" }
          : { code: 0, stdout: "abc\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: patch, stderr: "" };
    };
    const { files, errors } = await featureDiff("/h", "checkout", run);
    expect(files.every((f) => f.repo === "api")).toBe(true);
    expect(errors).toEqual([
      { repo: "web", message: expect.stringContaining("Not a valid object name") },
    ]);
  });
  it("reports a git diff --no-index failure beyond exit 1", async () => {
    const run: Exec = async (cmd, args) => {
      if (cmd === "ivar") return { code: 0, stderr: "", stdout: status({ repo: "api" }) };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "n.md\0", stderr: "" };
      if (args.includes("--no-index"))
        return { code: 2, stdout: "", stderr: "error: could not access" };
      return { code: 0, stdout: "", stderr: "" };
    };
    expect((await featureDiff("/h", "checkout", run)).errors).toEqual([
      { repo: "api", message: expect.stringContaining("could not access") },
    ]);
  });
  it("throws when ivar feature status fails", async () => {
    const run: Exec = async () => ({ code: 1, stdout: "", stderr: "feature `x` does not exist" });
    await expect(featureDiff("/h", "x", run)).rejects.toThrow("does not exist");
  });
});
