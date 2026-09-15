import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("vendored bb ui kit", () => {
  it("resolves the @/ alias and merges conflicting tailwind classes", () => {
    expect(cn("px-2 text-sm", { hidden: false }, "px-4")).toBe("text-sm px-4");
  });
});
