import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import type { Archiver } from 'archiver';
import {
  computeExternalArchivePath,
  getLockfilePathsToUpdate,
  getPackageJsonPathsToUpdate,
  shortHash,
  updatePackageJsonInArchive,
} from '../workspaces.js';

describe('computeExternalArchivePath', () => {
  it('places external workspace in _workspaces/ with basename-hash', () => {
    const localPath = '/Users/test/company-libs/utils';
    const result = computeExternalArchivePath(localPath);
    const expectedHash = shortHash(path.resolve(localPath));

    expect(result).toBe(path.join('_workspaces', `utils-${expectedHash}`));
  });

  it('does not include an external/ subdirectory', () => {
    const result = computeExternalArchivePath('/Users/test/libs/utils');

    expect(result).not.toContain('external');
    expect(result.startsWith('_workspaces')).toBe(true);
  });

  it('produces different paths for different directories with same basename', () => {
    const path1 = computeExternalArchivePath('/Users/test/project-a/utils');
    const path2 = computeExternalArchivePath('/Users/test/project-b/utils');

    expect(path1).not.toBe(path2);
    expect(path1).toContain('utils-');
    expect(path2).toContain('utils-');
  });

  it('is deterministic', () => {
    const localPath = '/Users/test/libs/utils';

    expect(computeExternalArchivePath(localPath)).toBe(
      computeExternalArchivePath(localPath)
    );
  });

  it('produces paths matching _workspaces/<name>-[8 hex chars]', () => {
    const result = computeExternalArchivePath('/Users/test/libs/utils');

    // Normalize path separators for cross-platform compatibility
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toMatch(/_workspaces\/utils-[a-f0-9]{8}$/);
  });

  it('uses the last path segment as basename', () => {
    const result = computeExternalArchivePath(
      '/Users/test/libs/@company/shared-utils'
    );

    expect(result).toContain('shared-utils-');
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toMatch(/_workspaces\/shared-utils-[a-f0-9]{8}$/);
  });

  it('never produces paths with .. segments', () => {
    const testCases = [
      '/Users/other/libs/utils',
      '/completely/different/path',
      '/Users/test/other-project/shared',
    ];

    testCases.forEach(localPath => {
      expect(computeExternalArchivePath(localPath)).not.toContain('..');
    });
  });
});

describe('shortHash', () => {
  it('produces 8-character hex string', () => {
    const hash = shortHash('/some/path');
    expect(hash).toMatch(/^[a-f0-9]{8}$/);
  });

  it('is deterministic', () => {
    const input = '/Users/test/workspace';
    expect(shortHash(input)).toBe(shortHash(input));
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = shortHash('/path/a');
    const hash2 = shortHash('/path/b');
    expect(hash1).not.toBe(hash2);
  });
});

describe('updatePackageJsonInArchive', () => {
  const srcDir = '/project/src';

  function createMockArchive() {
    const appended: Array<{ content: string; name: string }> = [];
    const mock: Partial<Archiver> = {
      append: (content: string, opts: { name: string }) => {
        appended.push({ content, name: opts.name });
        return mock as Archiver;
      },
    };
    return {
      archive: mock as Archiver,
      getAppended: () => appended,
    };
  }

  it('writes external workspace entries with relative archive paths', async () => {
    const packageJsonPath = '/project/src/app/functions/package.json';
    const originalPackageJson = {
      name: 'my-app',
      workspaces: ['../../packages/utils'],
      dependencies: {},
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(originalPackageJson)
    );

    const { archive, getAppended } = createMockArchive();
    const packageWorkspaces = new Map<string, string[]>();
    packageWorkspaces.set(packageJsonPath, [
      '../../_workspaces/packages-utils-a1b2c3d4',
      '../../_workspaces/packages-core-e5f6a7b8',
    ]);

    await updatePackageJsonInArchive(
      archive,
      srcDir,
      packageWorkspaces,
      new Map()
    );

    const appended = getAppended();
    expect(appended).toHaveLength(1);

    const written = JSON.parse(appended[0].content);
    expect(written.workspaces).toEqual([
      '../../_workspaces/packages-utils-a1b2c3d4',
      '../../_workspaces/packages-core-e5f6a7b8',
    ]);

    vi.restoreAllMocks();
  });

  it('preserves internal workspace entries as relative paths', async () => {
    const packageJsonPath = '/project/src/app/functions/package.json';
    const originalPackageJson = {
      name: 'my-app',
      workspaces: ['../packages/utils'],
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(originalPackageJson)
    );

    const { archive, getAppended } = createMockArchive();
    const packageWorkspaces = new Map<string, string[]>();
    packageWorkspaces.set(packageJsonPath, ['../packages/utils']);

    await updatePackageJsonInArchive(
      archive,
      srcDir,
      packageWorkspaces,
      new Map()
    );

    const written = JSON.parse(getAppended()[0].content);
    expect(written.workspaces).toEqual(['../packages/utils']);

    vi.restoreAllMocks();
  });

  it('writes mixed internal and external workspace entries', async () => {
    const packageJsonPath = '/project/src/app/functions/package.json';
    const originalPackageJson = {
      name: 'my-app',
      workspaces: ['../packages/utils', '../../_workspaces/logger-a1b2c3d4'],
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(originalPackageJson)
    );

    const { archive, getAppended } = createMockArchive();
    const packageWorkspaces = new Map<string, string[]>();
    packageWorkspaces.set(packageJsonPath, [
      '../packages/utils',
      '../../_workspaces/logger-a1b2c3d4',
    ]);

    await updatePackageJsonInArchive(
      archive,
      srcDir,
      packageWorkspaces,
      new Map()
    );

    const written = JSON.parse(getAppended()[0].content);
    expect(written.workspaces).toEqual([
      '../packages/utils',
      '../../_workspaces/logger-a1b2c3d4',
    ]);

    vi.restoreAllMocks();
  });

  it('rewrites external file: dependencies with relative archive paths', async () => {
    const packageJsonPath = '/project/src/app/functions/package.json';
    const originalPackageJson = {
      name: 'my-app',
      dependencies: {
        '@company/logger': 'file:../../external/logger',
        react: '^18.0.0',
      },
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(originalPackageJson)
    );

    const { archive, getAppended } = createMockArchive();
    const packageFileDeps = new Map<string, Map<string, string>>();
    packageFileDeps.set(
      packageJsonPath,
      new Map([['@company/logger', '../../_workspaces/logger-a1b2c3d4']])
    );

    await updatePackageJsonInArchive(
      archive,
      srcDir,
      new Map(),
      packageFileDeps
    );

    const appended = getAppended();
    expect(appended).toHaveLength(1);

    const written = JSON.parse(appended[0].content);
    expect(written.dependencies['@company/logger']).toBe(
      'file:../../_workspaces/logger-a1b2c3d4'
    );
    expect(written.dependencies['react']).toBe('^18.0.0');

    vi.restoreAllMocks();
  });

  it('leaves internal file: dependencies untouched when not in packageFileDeps', async () => {
    const originalPackageJson = {
      name: 'my-app',
      dependencies: {
        '@internal/utils': 'file:../packages/utils',
        react: '^18.0.0',
      },
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(originalPackageJson)
    );

    const { archive, getAppended } = createMockArchive();

    await updatePackageJsonInArchive(archive, srcDir, new Map(), new Map());

    // Nothing to update, so no package.json should be appended
    expect(getAppended()).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it('uses depth-appropriate relative paths for different package.json locations', async () => {
    const shallowPath = '/project/src/package.json';
    const deepPath = '/project/src/app/functions/nested/package.json';

    const makePackageJson = () => ({
      name: 'test',
      workspaces: ['placeholder'],
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const { archive: archive1, getAppended: getAppended1 } =
      createMockArchive();
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(makePackageJson())
    );
    const workspaces1 = new Map<string, string[]>();
    workspaces1.set(shallowPath, ['_workspaces/utils-a1b2c3d4']);
    await updatePackageJsonInArchive(archive1, srcDir, workspaces1, new Map());

    const { archive: archive2, getAppended: getAppended2 } =
      createMockArchive();
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(makePackageJson())
    );
    const workspaces2 = new Map<string, string[]>();
    workspaces2.set(deepPath, ['../../../_workspaces/utils-a1b2c3d4']);
    await updatePackageJsonInArchive(archive2, srcDir, workspaces2, new Map());

    const written1 = JSON.parse(getAppended1()[0].content);
    const written2 = JSON.parse(getAppended2()[0].content);

    expect(written1.workspaces).toEqual(['_workspaces/utils-a1b2c3d4']);
    expect(written2.workspaces).toEqual([
      '../../../_workspaces/utils-a1b2c3d4',
    ]);

    vi.restoreAllMocks();
  });
});

describe('getPackageJsonPathsToUpdate', () => {
  const srcDir = '/project/src';

  it('includes package.json with external workspace mapping', () => {
    const result = getPackageJsonPathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/functions/package.json',
        },
      ],
      []
    );

    expect(result).toEqual(
      new Set([
        path.relative(srcDir, '/project/src/app/functions/package.json'),
      ])
    );
  });

  it('includes package.json with internal workspace mapping', () => {
    const result = getPackageJsonPathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ],
      []
    );

    expect(result).toEqual(
      new Set([path.relative(srcDir, '/project/src/app/package.json')])
    );
  });

  it('includes package.json with external file dependency', () => {
    const result = getPackageJsonPathsToUpdate(
      srcDir,
      [],
      [
        {
          packageName: '@company/logger',
          localPath: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ]
    );

    expect(result).toEqual(
      new Set([path.relative(srcDir, '/project/src/app/package.json')])
    );
  });

  it('excludes package.json with only internal file dependencies', () => {
    const result = getPackageJsonPathsToUpdate(
      srcDir,
      [],
      [
        {
          packageName: '@internal/utils',
          localPath: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ]
    );

    expect(result.size).toBe(0);
  });

  it('deduplicates package.json paths from multiple mappings', () => {
    const result = getPackageJsonPathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
        {
          workspaceDir: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ],
      [
        {
          packageName: '@company/core',
          localPath: '/external/core',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ]
    );

    expect(result.size).toBe(1);
    expect(result).toEqual(
      new Set([path.relative(srcDir, '/project/src/app/package.json')])
    );
  });

  it('returns multiple paths for different package.json files', () => {
    const result = getPackageJsonPathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app1/package.json',
        },
        {
          workspaceDir: '/external/logger',
          sourcePackageJsonPath: '/project/src/app2/package.json',
        },
      ],
      []
    );

    expect(result.size).toBe(2);
    expect(result).toContain(
      path.relative(srcDir, '/project/src/app1/package.json')
    );
    expect(result).toContain(
      path.relative(srcDir, '/project/src/app2/package.json')
    );
  });

  it('returns empty set when no mappings provided', () => {
    const result = getPackageJsonPathsToUpdate(srcDir, [], []);
    expect(result.size).toBe(0);
  });
});

describe('getLockfilePathsToUpdate', () => {
  const srcDir = '/project/src';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns relative lock file path for dir with external workspace dep', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      p => p === '/project/src/app/package-lock.json'
    );

    const result = getLockfilePathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ],
      []
    );

    expect(result).toEqual(
      new Set([path.relative(srcDir, '/project/src/app/package-lock.json')])
    );
  });

  it('returns relative lock file path for dir with external file dep', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      p => p === '/project/src/app/package-lock.json'
    );

    const result = getLockfilePathsToUpdate(
      srcDir,
      [],
      [
        {
          packageName: '@company/logger',
          localPath: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ]
    );

    expect(result).toEqual(
      new Set([path.relative(srcDir, '/project/src/app/package-lock.json')])
    );
  });

  it('excludes dirs with only internal deps', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = getLockfilePathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ],
      [
        {
          packageName: '@internal/core',
          localPath: '/project/src/shared/core',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ]
    );

    expect(result.size).toBe(0);
  });

  it('excludes lock file when it does not exist on disk', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = getLockfilePathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ],
      []
    );

    expect(result.size).toBe(0);
  });

  it('deduplicates when multiple external deps share the same dir', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = getLockfilePathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
        {
          workspaceDir: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ],
      []
    );

    expect(result.size).toBe(1);
    expect(result).toContain(
      path.relative(srcDir, '/project/src/app/package-lock.json')
    );
  });

  it('returns multiple paths for different dirs with external deps', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = getLockfilePathsToUpdate(
      srcDir,
      [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app1/package.json',
        },
        {
          workspaceDir: '/external/logger',
          sourcePackageJsonPath: '/project/src/app2/package.json',
        },
      ],
      []
    );

    expect(result.size).toBe(2);
    expect(result).toContain(
      path.relative(srcDir, '/project/src/app1/package-lock.json')
    );
    expect(result).toContain(
      path.relative(srcDir, '/project/src/app2/package-lock.json')
    );
  });

  it('returns empty set when no mappings provided', () => {
    const result = getLockfilePathsToUpdate(srcDir, [], []);
    expect(result.size).toBe(0);
  });
});
