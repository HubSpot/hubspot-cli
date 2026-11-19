/*
 * Adapted from cross-spawn 7.0.6 (index.js and lib/parse.js)
 * https://github.com/moxystudio/node-cross-spawn
 * The cross-spawn license is reproduced in escape.ts.
 */

import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { lib } from '../../lang/en.js';
import { escapeArgument, escapeMetaCharacters } from './escape.js';
import { resolveCommand } from './resolveCommand.js';

const DEFAULT_SHELL = 'cmd.exe';
const SKIP_CURRENT_DIRECTORY_ENV_VAR = 'NoDefaultCurrentDirectoryInExePath';
const CMD_SHIM_PATTERN = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
const UNSAFE_ARG_PATTERN = /["%^&|<>\r\n]/;
const TRAILING_BACKSLASHES = '\\\\';

type CrossPlatformSpawnOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
};

function isUnsafeArg(arg: string): boolean {
  return UNSAFE_ARG_PATTERN.test(arg) || arg.endsWith(TRAILING_BACKSLASHES);
}

function assertArgsAreSafe(args: string[]): void {
  const unsafeArg = args.find(isUnsafeArg);

  if (unsafeArg !== undefined) {
    throw new Error(lib.crossPlatformSpawn.unsafeArg(unsafeArg));
  }
}

function buildShellLine(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): string {
  const file = resolveCommand(command, env);
  const doubleEscapeMetaChars =
    file !== undefined && CMD_SHIM_PATTERN.test(file);

  return [
    escapeMetaCharacters(path.win32.normalize(command)),
    ...args.map(arg => escapeArgument(arg, doubleEscapeMetaChars)),
  ].join(' ');
}

export function crossPlatformSpawn(
  command: string,
  args: string[],
  options: CrossPlatformSpawnOptions
): ChildProcessWithoutNullStreams {
  if (process.platform !== 'win32') {
    return spawn(command, args, options);
  }

  assertArgsAreSafe(args);

  return spawn(
    process.env.comspec || DEFAULT_SHELL,
    ['/d', '/s', '/c', `"${buildShellLine(command, args, options.env)}"`],
    {
      ...options,
      env: { ...options.env, [SKIP_CURRENT_DIRECTORY_ENV_VAR]: '1' },
      windowsVerbatimArguments: true,
    }
  );
}
