import { execFile } from 'child_process';
import { mkdir as fsMkdir } from 'fs/promises';
import { promisify } from 'util';

const promisifiedExecFile = promisify(execFile);

/** Wrapper around child_process.execFile for test mockability */
export async function execFileAsync(
  cmd: string,
  args: string[],
  options?: { timeout?: number; cwd?: string; maxBuffer?: number; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string }> {
  const result = await promisifiedExecFile(cmd, args, options);
  return {
    stdout: (result.stdout ?? '').toString(),
    stderr: (result.stderr ?? '').toString(),
  };
}

/**
 * Like {@link execFileAsync}, but pipes `input` to the child's stdin.
 *
 * Lets callers pass arbitrarily large payloads (e.g. interpreter scripts) without
 * hitting the kernel's per-argv size limit — a single exec argument is capped at
 * 128KiB on Linux (MAX_ARG_STRLEN) and ~32KB on Windows, failing with E2BIG at
 * posix_spawn. Stdin has no such cap.
 */
export function execFileStdinAsync(
  cmd: string,
  args: string[],
  input: string,
  options?: { timeout?: number; cwd?: string; maxBuffer?: number; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, options ?? {}, (error, stdout, stderr) => {
      if (error) {
        // Match promisify(execFile) semantics: attach captured output to the error
        // so callers can read err.stdout / err.stderr for diagnostics.
        const err: Error & { stdout?: string; stderr?: string } = error;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
    // Ignore stdin write errors (EPIPE): the child may legitimately exit
    // before consuming all of its stdin (e.g. a script with an early exit).
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(input);
  });
}

/** Wrapper around fs.mkdir for test mockability */
export async function mkdirAsync(path: string, options?: { recursive?: boolean }): Promise<void> {
  await fsMkdir(path, options);
}
