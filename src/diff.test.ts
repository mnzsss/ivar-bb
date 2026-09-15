import { describe, expect, it } from "vitest";
import { featureDiff, splitPatch, untrackedPatch, UNTRACKED_MAX_BYTES } from "./diff";
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
  it("includes untracked files as new-file patches without a process per file", async () => {
    const calls: string[][] = [];
    const run: Exec = async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === "ivar") return { code: 0, stderr: "", stdout: status({ repo: "api" }) };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc123\n", stderr: "" };
      if (args[0] === "ls-files")
        return {
          code: 0,
          stdout: Array.from({ length: 50 }, (_, i) => `n${i}.md\0`).join(""),
          stderr: "",
        };
      return { code: 0, stdout: "", stderr: "" };
    };
    const readFile = async (p: string) => Buffer.from(`${p}\n`);
    const { files } = await featureDiff("/h", "checkout", run, readFile);
    expect(files).toHaveLength(50);
    expect(files[0]).toEqual({
      repo: "api",
      path: "n0.md",
      patch: untrackedPatch("n0.md", Buffer.from("/h/.ivar/repos/api/checkout/n0.md\n")),
    });
    expect(calls).toHaveLength(4);
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
  it("reports an unreadable untracked file for that repo", async () => {
    const run: Exec = async (cmd, args) => {
      if (cmd === "ivar") return { code: 0, stderr: "", stdout: status({ repo: "api" }) };
      if (args[0] === "merge-base") return { code: 0, stdout: "abc\n", stderr: "" };
      if (args[0] === "ls-files") return { code: 0, stdout: "n.md\0", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    };
    const readFile = async () => {
      throw new Error("EACCES: permission denied, open 'n.md'");
    };
    expect((await featureDiff("/h", "checkout", run, readFile)).errors).toEqual([
      { repo: "api", message: expect.stringContaining("permission denied") },
    ]);
  });
  it("throws when ivar feature status fails", async () => {
    const run: Exec = async () => ({ code: 1, stdout: "", stderr: "feature `x` does not exist" });
    await expect(featureDiff("/h", "x", run)).rejects.toThrow("does not exist");
  });
});

describe("untrackedPatch", () => {
  it("matches git's new-file hunk for text ending in a newline", () => {
    expect(untrackedPatch("notes/new.md", Buffer.from("hi\nthere\n"))).toBe(
      "diff --git a/notes/new.md b/notes/new.md\nnew file mode 100644\n--- /dev/null\n+++ b/notes/new.md\n@@ -0,0 +1,2 @@\n+hi\n+there\n",
    );
  });
  it("marks a missing trailing newline", () => {
    expect(untrackedPatch("a.txt", Buffer.from("x"))).toBe(
      "diff --git a/a.txt b/a.txt\nnew file mode 100644\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1 @@\n+x\n\\ No newline at end of file\n",
    );
  });
  it("renders binary and oversized files without their content", () => {
    expect(untrackedPatch("i.png", Buffer.from([0x89, 0, 1]))).toBe(
      "diff --git a/i.png b/i.png\nnew file mode 100644\nBinary files /dev/null and b/i.png differ\n",
    );
    expect(untrackedPatch("big.log", Buffer.alloc(UNTRACKED_MAX_BYTES + 1, 97))).toBe(
      "diff --git a/big.log b/big.log\nnew file mode 100644\nBinary files /dev/null and b/big.log differ\n",
    );
  });
  it("keeps an empty file addressable by its header path", () => {
    expect(
      splitPatch("api", untrackedPatch("empty.txt", Buffer.alloc(0))).map((f) => f.path),
    ).toEqual(["empty.txt"]);
  });
});
