import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bbStyledScreens = ["src/app/review-view.tsx", "src/app/file-diff.tsx"];
const noInlineStyleScreens = ["src/app/review-view.tsx"];

describe("plugin screens follow bb's design system", () => {
  it.each(bbStyledScreens)("%s renders bb components instead of native controls", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/<(button|input|select|textarea|table)\b/);
  });
  it.each(bbStyledScreens)("%s uses host token classes, not raw CSS variables", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(
      /\[var\(--(?!diff-added|diff-removed|warning-text)/,
    );
  });
  it.each(noInlineStyleScreens)("%s has no inline style props", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/style=\{\{/);
  });
  it("retired the hand-rolled class strings", () => {
    expect(existsSync("src/app/ui.ts")).toBe(false);
  });
});
