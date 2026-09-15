import { describe, expect, it } from "vitest";
import {
  countChanges,
  errorMessage,
  fileKey,
  groupByRepo,
  reuseIfEqual,
  reuseUnchangedFiles,
  toAnnotations,
  toCommentRange,
  toggleKey,
} from "./review-model";

const file = (repo: string, path: string) => ({ repo, path, patch: "" });
const comment = (
  id: string,
  repo: string,
  path: string,
  line_end: number,
  status: "open" | "resolved" = "open",
) => ({ id, repo, file: path, line_start: 1, line_end, body: id, status });

describe("groupByRepo", () => {
  it("keeps repo order of first appearance and file order within a repo", () => {
    const groups = groupByRepo([file("api", "a"), file("web", "w"), file("api", "b")]);
    expect(groups.map((g) => [g.repo, g.files.map((f) => f.path)])).toEqual([
      ["api", ["a", "b"]],
      ["web", ["w"]],
    ]);
  });
});

describe("toAnnotations", () => {
  it("anchors open and resolved comments of this repo and file at their last line on the new side", () => {
    const anns = toAnnotations(file("api", "a"), [
      comment("c1", "api", "a", 7),
      comment("c2", "api", "b", 2),
      comment("c3", "web", "a", 4),
      comment("c4", "api", "a", 9, "resolved"),
    ]);
    expect(anns.map((a) => [a.lineNumber, a.metadata.id])).toEqual([
      [7, "c1"],
      [9, "c4"],
    ]);
    expect(anns.every((a) => a.side === "additions")).toBe(true);
  });
});

describe("toCommentRange", () => {
  it("keeps every line of a forward or reversed new-side selection", () => {
    expect(toCommentRange({ start: 3, end: 5 })).toEqual({
      kind: "range",
      start: 3,
      end: 5,
      side: "additions",
    });
    expect(toCommentRange({ start: 5, side: "additions", end: 3, endSide: "additions" })).toEqual({
      kind: "range",
      start: 3,
      end: 5,
      side: "additions",
    });
    expect(toCommentRange(null)).toBeNull();
  });
  it("rejects a selection touching deleted lines, since comments carry no side", () => {
    expect(toCommentRange({ start: 3, side: "deletions", end: 3 })).toEqual({ kind: "rejected" });
    expect(toCommentRange({ start: 3, side: "additions", end: 5, endSide: "deletions" })).toEqual({
      kind: "rejected",
    });
  });
});

describe("errorMessage", () => {
  it("uses the Error message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
  it("stringifies a non-Error value", () => {
    expect(errorMessage("boom")).toBe("boom");
    expect(errorMessage(null)).toBe("null");
  });
});

describe("toggleKey", () => {
  it("adds a missing key and removes a present one without mutating the input", () => {
    const empty = new Set<string>();
    const one = toggleKey(empty, "api/a");
    expect([...one]).toEqual(["api/a"]);
    expect([...toggleKey(one, "api/a")]).toEqual([]);
    expect(empty.size).toBe(0);
  });
});

describe("countChanges", () => {
  it("counts added and removed lines, ignoring the file headers", () => {
    const patch =
      "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n ctx\n-old\n+new\n+more\n";
    expect(countChanges(patch)).toEqual({ additions: 2, deletions: 1 });
  });
});

describe("fileKey", () => {
  it("joins repo and path", () => expect(fileKey(file("api", "src/a.ts"))).toBe("api/src/a.ts"));
});

describe("reuseUnchangedFiles", () => {
  const entry = (path: string, patch: string) => ({ repo: "api", path, patch });
  it("returns the previous array when every patch is unchanged", () => {
    const previous = [entry("a", "p1"), entry("b", "p2")];
    expect(reuseUnchangedFiles(previous, [entry("a", "p1"), entry("b", "p2")])).toBe(previous);
  });
  it("keeps unchanged entries by identity and takes changed or new ones in the latest order", () => {
    const a = entry("a", "p1");
    const changedB = entry("b", "p2-edited");
    const newC = { repo: "web", path: "c", patch: "p3" };
    const next = reuseUnchangedFiles([a, entry("b", "p2")], [newC, entry("a", "p1"), changedB]);
    expect(next).toHaveLength(3);
    expect(next[0]).toBe(newC);
    expect(next[1]).toBe(a);
    expect(next[2]).toBe(changedB);
  });
  it("drops files that are gone", () => {
    const a = entry("a", "p1");
    const next = reuseUnchangedFiles([a, entry("b", "p2")], [entry("a", "p1")]);
    expect(next).toHaveLength(1);
    expect(next[0]).toBe(a);
  });
});

describe("reuseIfEqual", () => {
  it("keeps the previous value only when the next one has the same content", () => {
    const previous = [comment("1", "api", "a", 3)];
    expect(reuseIfEqual(previous, [comment("1", "api", "a", 3)])).toBe(previous);
    const resolved = [comment("1", "api", "a", 3, "resolved")];
    expect(reuseIfEqual(previous, resolved)).toBe(resolved);
  });
});
