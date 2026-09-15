import { describe, expect, it } from "vitest";
import { groupByRepo, toAnnotations, toCommentRange } from "./review-model";

const file = (repo: string, path: string) => ({ repo, path, patch: "" });
const comment = (id: string, repo: string, path: string, line_end: number, status: "open" | "resolved" = "open") =>
  ({ id, repo, file: path, line_start: 1, line_end, body: id, status });

describe("groupByRepo", () => {
  it("keeps repo order of first appearance and file order within a repo", () => {
    const groups = groupByRepo([file("api", "a"), file("web", "w"), file("api", "b")]);
    expect(groups.map((g) => [g.repo, g.files.map((f) => f.path)])).toEqual([["api", ["a", "b"]], ["web", ["w"]]]);
  });
});

describe("toAnnotations", () => {
  it("anchors open and resolved comments of this repo and file at their last line on the new side", () => {
    const anns = toAnnotations(file("api", "a"), [
      comment("c1", "api", "a", 7), comment("c2", "api", "b", 2), comment("c3", "web", "a", 4), comment("c4", "api", "a", 9, "resolved"),
    ]);
    expect(anns.map((a) => [a.lineNumber, a.metadata.id])).toEqual([[7, "c1"], [9, "c4"]]);
    expect(anns.every((a) => a.side === "additions")).toBe(true);
  });
});

describe("toCommentRange", () => {
  it("keeps every line of a forward, reversed or cross-side selection", () => {
    expect(toCommentRange({ start: 3, end: 5 })).toEqual({ start: 3, end: 5 });
    expect(toCommentRange({ start: 5, end: 3 })).toEqual({ start: 3, end: 5 });
    expect(toCommentRange({ start: 3, side: "deletions", end: 5, endSide: "additions" } as { start: number; end: number })).toEqual({ start: 3, end: 5 });
    expect(toCommentRange(null)).toBeNull();
  });
});
