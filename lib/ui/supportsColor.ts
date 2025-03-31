import process from 'process';
import os from 'os';
import tty from 'tty';
import { hasFlag } from '../yargsUtils';

const { env } = process;

//From: https://github.com/chalk/supports-color/blob/main/index.js (License: https://github.com/chalk/supports-color/blob/main/license)

interface ColorSupportLevel {
  level: number;
  hasBasic: boolean;
  has256: boolean;
  has16m: boolean;
}

function translateLevel(level: number): ColorSupportLevel {
  if (level === 0) {
    return {
      level,
      hasBasic: false,
      has256: false,
      has16m: false,
    };
  }

  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  };
}

function _supportsColor(
  haveStream: { isTTY?: boolean } | null,
  { streamIsTTY }: { streamIsTTY?: boolean } = {}
) {
  if (haveStream && !streamIsTTY) {
    return 0;
  }

  const min = 0;

  if (env.TERM === 'dumb') {
    return min;
  }

  if (hasFlag('noColor')) {
    return 0;
  }

  if (process.platform === 'win32') {
    // Windows 10 build 10586 is the first Windows release that supports 256 colors.
    // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
    const osRelease = os.release().split('.');
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }

    return 1;
  }

  if ('CI' in env) {
    if (
      [
        'TRAVIS',
        'CIRCLECI',
        'APPVEYOR',
        'GITLAB_CI',
        'GITHUB_ACTIONS',
        'BUILDKITE',
        'DRONE',
      ].some(sign => sign in env) ||
      env.CI_NAME === 'codeship'
    ) {
      return 1;
    }

    return min;
  }

  // Check for Azure DevOps pipelines
  if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
    return 1;
  }

  if (env.COLORTERM === 'truecolor') {
    return 3;
  }

  if ('TERM_PROGRAM' in env) {
    const version = Number.parseInt(
      (env.TERM_PROGRAM_VERSION || '').split('.')[0],
      10
    );

    switch (env.TERM_PROGRAM) {
      case 'iTerm.app':
        return version >= 3 ? 3 : 2;
      case 'Apple_Terminal':
        return 2;
      // No default
    }
  }

  if (env.TERM && /-256(color)?$/i.test(env.TERM)) {
    return 2;
  }

  if (
    env.TERM &&
    /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)
  ) {
    return 1;
  }

  if ('COLORTERM' in env) {
    return 1;
  }

  return min;
}

function createSupportsColor(
  stream: { isTTY?: boolean } | null,
  options: { streamIsTTY?: boolean } = {}
): ColorSupportLevel {
  const level = _supportsColor(stream, {
    streamIsTTY: stream?.isTTY,
    ...options,
  });

  return translateLevel(level);
}

export const supportsColor = {
  createSupportsColor,
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) }),
};
