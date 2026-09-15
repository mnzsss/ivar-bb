import { execFile, type ExecFileException } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";

export type Exec = (cmd: string, args: string[], cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>;

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
