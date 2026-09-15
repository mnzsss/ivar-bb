import { describe, expect, it } from "vitest";
import { parsePanelRoute, pickProject } from "./panel-route.js";

const projects = [
  { id: "personal", isPersonal: true },
  { id: "a", isPersonal: false },
  { id: "b", isPersonal: false },
];

describe("pickProject", () => {
  it("keeps a preferred id that exists", () => expect(pickProject(projects, "b")).toBe("b"));
  it("falls back to the first non-personal project", () =>
    expect(pickProject(projects, "gone")).toBe("a"));
  it("returns null without projects", () => expect(pickProject([], null)).toBeNull());
});

describe("parsePanelRoute", () => {
  it("reads project and feature", () =>
    expect(parsePanelRoute("a/features/my%20f")).toEqual({ projectId: "a", feature: "my f" }));
  it("reads a bare project", () =>
    expect(parsePanelRoute("a")).toEqual({ projectId: "a", feature: null }));
  it("handles the root", () =>
    expect(parsePanelRoute("")).toEqual({ projectId: null, feature: null }));
});
