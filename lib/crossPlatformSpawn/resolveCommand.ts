/*
 * Adapted from cross-spawn 7.0.6 (lib/util/resolveCommand.js), whose
 * license is reproduced in escape.ts, and from the packages below.
 *
 * which 2.0.2 (which.js) and isexe 2.0.0 (windows.js)
 * https://github.com/isaacs/node-which
 * https://github.com/isaacs/isexe
 *
 * The ISC License
 *
 * Copyright (c) Isaac Z. Schlueter and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
 * IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * path-key 3.1.1 (index.js)
 * https://github.com/sindresorhus/path-key
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import fs from 'fs';
import path from 'path';

const PATH_DELIMITER = ';';
const DEFAULT_PATH_EXT = '.EXE;.CMD;.BAT;.COM';
const QUOTED_PATH_PATTERN = /^".*"$/;

function getPathKey(env: NodeJS.ProcessEnv): string {
  return (
    Object.keys(env)
      .reverse()
      .find(key => key.toUpperCase() === 'PATH') || 'Path'
  );
}

function unquote(directory: string): string {
  return QUOTED_PATH_PATTERN.test(directory)
    ? directory.slice(1, -1)
    : directory;
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function resolveCommand(
  command: string,
  env: NodeJS.ProcessEnv
): string | undefined {
  const directories = (env[getPathKey(env)] || process.env.PATH || '')
    .split(PATH_DELIMITER)
    .map(unquote);
  const extensions = (process.env.PATHEXT || DEFAULT_PATH_EXT).split(
    PATH_DELIMITER
  );

  return directories
    .flatMap(directory =>
      extensions.map(extension =>
        path.win32.join(directory, command + extension)
      )
    )
    .find(isFile);
}
