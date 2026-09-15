import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBinary } from "./exec";

describe("resolveBinary", () => {
  it("returns the first executable on PATH, falling back to the bare name", async () => {
    const empty = await mkdtemp(join(tmpdir(), "rb-"));
    const dir = await mkdtemp(join(tmpdir(), "rb-"));
    await writeFile(join(dir, "ivar"), "", { mode: 0o755 });
    expect(await resolveBinary("ivar", `${empty}:${dir}`)).toBe(join(dir, "ivar"));
    expect(await resolveBinary("ivar", empty)).toBe("ivar");
  });
});
