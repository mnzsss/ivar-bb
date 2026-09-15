import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bbStyledScreens = [
  "src/app/review-view.tsx",
  "src/app/file-diff.tsx",
  "app.tsx",
  "src/app/hall-view.tsx",
  "src/app/comments-tab.tsx",
];
const noInlineStyleScreens = [
  "src/app/review-view.tsx",
  "app.tsx",
  "src/app/hall-view.tsx",
  "src/app/comments-tab.tsx",
];

const source = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

describe("plugin screens follow bb's design system", () => {
  it.each(bbStyledScreens)("%s renders bb components instead of native controls", (file) => {
    expect(source(file)).not.toMatch(/<(button|input|select|textarea|table)\b/);
  });
  it.each(bbStyledScreens)("%s uses host token classes, not raw CSS variables", (file) => {
    expect(source(file)).not.toMatch(/\[var\(--(?!diff-added|diff-removed|warning-text)/);
  });
  it.each(noInlineStyleScreens)("%s has no inline style props", (file) => {
    expect(source(file)).not.toMatch(/style=\{\{/);
  });
});
