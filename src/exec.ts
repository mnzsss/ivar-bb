import { execFile, type ExecFileException } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";
import type { z } from "zod";

export type ExecResult = { code: number; stdout: string; stderr: string };
export type Exec = (cmd: string, args: string[], cwd: string) => Promise<ExecResult>;

export const exec: Exec = (cmd, args, cwd) =>
  new Promise((resolve) =>
    execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ code: err ? exitCode(err) : 0, stdout, stderr }),
    ),
  );

function exitCode(err: ExecFileException): number {
  if (err.code === "ENOENT") return 127;
  return typeof err.code === "number" ? err.code : 1;
}

export function checkedStdout(result: ExecResult, cmd: string, args: string[], okCodes = [0]): string {
  if (okCodes.includes(result.code)) return result.stdout;
  const detail = result.stderr.trim() || result.stdout.trim();
  throw new Error(`${cmd} ${args.join(" ")} exited ${result.code}${detail ? `: ${detail}` : ""}`);
}

export async function checked(run: Exec, cmd: string, args: string[], cwd: string, okCodes = [0]): Promise<string> {
  return checkedStdout(await run(cmd, args, cwd), cmd, args, okCodes);
}

export const parseIvarJson = <T>(stdout: string, schema: z.ZodType<T>): T => schema.parse(JSON.parse(stdout));

export async function ivarJson<T>(root: string, args: string[], run: Exec, schema: z.ZodType<T>): Promise<T> {
  return parseIvarJson(await checked(run, "ivar", ["--json", ...args], root), schema);
}

export async function fsExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolveBinary(name: string, path = process.env.PATH ?? ""): Promise<string> {
  for (const dir of path.split(delimiter).filter(Boolean)) {
    const candidate = join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return name;
}
