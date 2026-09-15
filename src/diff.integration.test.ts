import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { featureDiff } from "./diff";
import { exec, type Exec } from "./exec";

const worktree = mkdtempSync(join(tmpdir(), "ivar-bb-perf-"));
afterAll(() => rmSync(worktree, { recursive: true, force: true }));

describe("featureDiff against a real git worktree", () => {
  it("diffs 150 tracked edits and 60 untracked files with three git processes, tolerating symlinks and nested repos", async () => {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: worktree });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "perf@example.com");
    git("config", "user.name", "perf");
    mkdirSync(join(worktree, "src"));
    for (let i = 0; i < 150; i++)
      writeFileSync(join(worktree, "src", `f${i}.ts`), `export const v${i} = 0;\n`);
    git("add", ".");
    git("commit", "-qm", "base");
    for (let i = 0; i < 150; i++)
      writeFileSync(join(worktree, "src", `f${i}.ts`), `export const v${i} = 1;\n`);
    for (let i = 0; i < 60; i++) writeFileSync(join(worktree, `new${i}.md`), `note ${i}\n`);
    symlinkSync("src", join(worktree, "linked-src"));
    symlinkSync("missing-target", join(worktree, "dangling"));
    mkdirSync(join(worktree, "nested"));
    execFileSync("git", ["init", "-q"], { cwd: join(worktree, "nested") });

    let gitProcesses = 0;
    const run: Exec = async (cmd, args, cwd) => {
      if (cmd === "ivar")
        return {
          code: 0,
          stderr: "",
          stdout: JSON.stringify({
            repos: [
              { repo: "api", worktree, base: "main", worktree_present: true, state: "ready" },
            ],
          }),
        };
      gitProcesses++;
      return exec(cmd, args, cwd);
    };

    const { files, errors } = await featureDiff("/unused", "perf", run);

    expect(errors).toEqual([]);
    expect(files.filter((f) => f.path.endsWith(".ts") || f.path.endsWith(".md"))).toHaveLength(210);
    expect(files.some((f) => f.path.startsWith("nested"))).toBe(false);
    expect(files.find((f) => f.path === "dangling")?.patch).toContain(
      "new file mode 120000\n--- /dev/null\n+++ b/dangling\n@@ -0,0 +1 @@\n+missing-target\n",
    );
    expect(files.find((f) => f.path === "new7.md")?.patch).toContain("+note 7\n");
    expect(files.find((f) => f.path === "src/f3.ts")?.patch).toContain("+export const v3 = 1;");
    expect(gitProcesses).toBe(3);
  });
});
