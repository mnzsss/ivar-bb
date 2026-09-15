import { execFile, type ExecFileException } from "node:child_process";
import { access } from "node:fs/promises";

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
