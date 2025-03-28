import { hasFlag } from '../yargsUtils';

//See https://github.com/jamestalmage/supports-hyperlinks (License: https://github.com/jamestalmage/supports-hyperlinks/blob/master/license)

function parseVersion(versionString: string): {
  major: number;
  minor: number;
  patch: number;
} {
  if (/^\d{3,4}$/.test(versionString)) {
    // Env var doesn't always use dots. example: 4601 => 46.1.0
    const m = /(\d{1,2})(\d{2})/.exec(versionString);
    return {
      major: 0,
      minor: parseInt(m![1], 10),
      patch: parseInt(m![2], 10),
    };
  }

  const versions = (versionString || '').split('.').map(n => parseInt(n, 10));
  return {
    major: versions[0] || 0,
    minor: versions[1] || 0,
    patch: versions[2] || 0,
  };
}

function supportsHyperlink(stream?: NodeJS.WriteStream): boolean {
  const { env } = process;

  if (hasFlag('noHyperlinks')) {
    return false;
  }

  if (stream && !stream.isTTY) {
    return false;
  }

  if (process.platform === 'win32') {
    return false;
  }

  if ('CI' in env) {
    return false;
  }

  if ('TERM_PROGRAM' in env) {
    const version = parseVersion(env.TERM_PROGRAM_VERSION || '');

    switch (env.TERM_PROGRAM) {
      case 'iTerm.app':
        if (version.major === 3) {
          return version.minor >= 1;
        }

        return version.major > 3;
      // No default
    }
  }

  if ('VTE_VERSION' in env) {
    // 0.50.0 was supposed to support hyperlinks, but throws a segfault
    if (env.VTE_VERSION === '0.50.0') {
      return false;
    }

    const version = parseVersion(env.VTE_VERSION || '');
    return version.major > 0 || version.minor >= 50;
  }

  return false;
}

export const supportsHyperlinkModule = {
  supportsHyperlink,
  stdout: supportsHyperlink(process.stdout as NodeJS.WriteStream),
  stderr: supportsHyperlink(process.stderr as NodeJS.WriteStream),
};
