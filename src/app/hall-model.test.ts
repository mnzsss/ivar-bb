import { describe, expect, it } from "vitest";
import { hallSummary } from "./hall-model";

describe("hallSummary", () => {
  it("explains why the panel is empty", () => {
    expect(hallSummary({ status: "no-hall" }).empty).toMatch(/no ivar\.json/i);
    expect(hallSummary({ status: "ivar-missing" }).empty).toMatch(/ivar.*PATH/);
  });
  it("lists features with their promoted repos and a review link", () => {
    const s = hallSummary({ status: "ok", root: "/h", repos: ["api", "web"], features: [{ name: "checkout", promoted: ["api"] }] });
    expect(s.title).toBe("/h");
    expect(s.features).toEqual([{ name: "checkout", promoted: ["api"], href: "features/checkout" }]);
  });
});
