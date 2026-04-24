import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@hubspot/project-parsing-lib/workspaces', () => ({
  getPackableFiles: vi.fn(),
}));
vi.mock('@hubspot/local-dev-lib/ignoreRules', () => ({
  shouldIgnoreFile: vi.fn(),
}));
vi.mock('../../ui/logger.js', () => ({
  uiLogger: {
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import path from 'path';
import fs from 'fs-extra';
import type { Archiver, EntryData } from 'archiver';
import { getPackableFiles } from '@hubspot/project-parsing-lib/workspaces';
import type {
  WorkspaceMapping,
  FileDependencyMapping,
} from '@hubspot/project-parsing-lib/workspaces';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import {
  archiveWorkspacesAndDependencies,
  computeExternalArchivePath,
  rewriteLockfileForExternalDeps,
} from '../workspaces.js';

type DirectoryCall = {
  sourcePath: string;
  destPath: string | false;
  filter?: (file: EntryData) => false | EntryData;
};

function createMockArchive() {
  const directoryCalls: DirectoryCall[] = [];
  const appendCalls: Array<{ content: string; name: string }> = [];

  const mock = {
    directory: vi.fn(
      (
        sourcePath: string,
        destPath: string | false,
        filter?: (file: EntryData) => false | EntryData
      ) => {
        directoryCalls.push({ sourcePath, destPath, filter });
        return mock;
      }
    ),
    append: vi.fn((content: unknown, opts: { name: string }) => {
      appendCalls.push({ content: content as string, name: opts.name });
      return mock;
    }),
  };

  return {
    archive: mock as unknown as Archiver,
    directoryCalls,
    appendCalls,
  };
}

describe('archiveWorkspacesAndDependencies', () => {
  const srcDir = '/project/src';
  const projectDir = '/project';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPackableFiles).mockResolvedValue(new Set());
    vi.mocked(shouldIgnoreFile).mockReturnValue(false);
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty maps when no workspaces or file deps provided', async () => {
    const { archive, directoryCalls } = createMockArchive();

    const result = await archiveWorkspacesAndDependencies(
      archive,
      srcDir,
      projectDir,
      [],
      []
    );

    expect(result.packageWorkspaces.size).toBe(0);
    expect(result.packageFileDeps.size).toBe(0);
    expect(directoryCalls).toHaveLength(0);
  });

  describe('workspace archiving', () => {
    it('archives external workspace via archive.directory', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(directoryCalls).toHaveLength(1);
      expect(directoryCalls[0].sourcePath).toBe('/external/utils');
      expect(directoryCalls[0].destPath).toBe(
        computeExternalArchivePath('/external/utils')
      );
    });

    it('does not archive internal workspace', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(directoryCalls).toHaveLength(0);
    });

    it('stores relative path for internal workspace', async () => {
      const { archive } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const entries = result.packageWorkspaces.get(
        '/project/src/app/package.json'
      );
      expect(entries).toHaveLength(1);
      expect(entries![0]).toBe(
        path.relative('/project/src/app', '/project/src/packages/utils')
      );
    });

    it('stores relative archive path for external workspace', async () => {
      const { archive } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const entries = result.packageWorkspaces.get(
        '/project/src/app/package.json'
      );
      expect(entries).toHaveLength(1);
      expect(entries![0]).toBe(
        `../${computeExternalArchivePath('/external/utils')}`
      );
    });

    it('archives external workspace only once when referenced by multiple package.jsons', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app1/package.json',
        },
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app2/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(directoryCalls).toHaveLength(1);

      const entries1 = result.packageWorkspaces.get(
        '/project/src/app1/package.json'
      );
      const entries2 = result.packageWorkspaces.get(
        '/project/src/app2/package.json'
      );
      expect(entries1).toHaveLength(1);
      expect(entries2).toHaveLength(1);
      expect(entries1![0]).toBe(entries2![0]);
    });

    it('handles mix of internal and external workspaces for same package.json', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
        {
          workspaceDir: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(directoryCalls).toHaveLength(1);
      expect(directoryCalls[0].sourcePath).toBe('/external/logger');

      const entries = result.packageWorkspaces.get(
        '/project/src/app/package.json'
      );
      expect(entries).toHaveLength(2);
      expect(entries![0]).toBe(
        path.relative('/project/src/app', '/project/src/packages/utils')
      );
      expect(entries![1]).toBe(
        `../${computeExternalArchivePath('/external/logger')}`
      );
    });
  });

  describe('file dependency archiving', () => {
    it('archives external file dependency', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: '@company/logger',
          localPath: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        fileDeps
      );

      expect(directoryCalls).toHaveLength(1);
      expect(directoryCalls[0].sourcePath).toBe('/external/logger');
      expect(directoryCalls[0].destPath).toBe(
        computeExternalArchivePath('/external/logger')
      );

      const fileDepsMap = result.packageFileDeps.get(
        '/project/src/app/package.json'
      );
      expect(fileDepsMap!.get('@company/logger')).toBe(
        `../${computeExternalArchivePath('/external/logger')}`
      );
    });

    it('skips internal file dependency', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: '@internal/utils',
          localPath: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        fileDeps
      );

      expect(directoryCalls).toHaveLength(0);
      expect(result.packageFileDeps.size).toBe(0);
    });

    it('does not re-archive path already archived as workspace', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/shared-lib',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: 'shared-lib',
          localPath: '/external/shared-lib',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        fileDeps
      );

      expect(directoryCalls).toHaveLength(1);

      const fileDepsMap = result.packageFileDeps.get(
        '/project/src/app/package.json'
      );
      expect(fileDepsMap).toBeDefined();
      expect(fileDepsMap!.get('shared-lib')).toBe(
        `../${computeExternalArchivePath('/external/shared-lib')}`
      );
    });

    it('deduplicates external file dep from multiple package.jsons', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: 'shared',
          localPath: '/external/shared',
          sourcePackageJsonPath: '/project/src/app1/package.json',
        },
        {
          packageName: 'shared',
          localPath: '/external/shared',
          sourcePackageJsonPath: '/project/src/app2/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        fileDeps
      );

      expect(directoryCalls).toHaveLength(1);

      const fileDeps1 = result.packageFileDeps.get(
        '/project/src/app1/package.json'
      );
      const fileDeps2 = result.packageFileDeps.get(
        '/project/src/app2/package.json'
      );
      expect(fileDeps1!.get('shared')).toBe(fileDeps2!.get('shared'));
    });
  });

  describe('file filtering', () => {
    it('calls getPackableFiles for each external workspace and file dep', async () => {
      const { archive } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: 'logger',
          localPath: '/external/logger',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        fileDeps
      );

      expect(getPackableFiles).toHaveBeenCalledTimes(2);
      expect(getPackableFiles).toHaveBeenCalledWith('/external/utils');
      expect(getPackableFiles).toHaveBeenCalledWith('/external/logger');
    });

    it('does not call getPackableFiles for internal workspaces', async () => {
      const { archive } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(getPackableFiles).not.toHaveBeenCalled();
    });

    it('passes filter that excludes files not in packable set', async () => {
      vi.mocked(getPackableFiles).mockResolvedValue(
        new Set(['index.js', 'package.json'])
      );
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const filter = directoryCalls[0].filter!;
      expect(filter({ name: 'index.js' } as EntryData)).toBeTruthy();
      expect(filter({ name: 'package.json' } as EntryData)).toBeTruthy();
      expect(filter({ name: 'secret.txt' } as EntryData)).toBe(false);
    });

    it('passes filter that excludes files matched by shouldIgnoreFile', async () => {
      vi.mocked(shouldIgnoreFile).mockImplementation(
        (filename: string) => filename === 'node_modules/dep/index.js'
      );
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const filter = directoryCalls[0].filter!;
      expect(filter({ name: 'index.js' } as EntryData)).toBeTruthy();
      expect(filter({ name: 'node_modules/dep/index.js' } as EntryData)).toBe(
        false
      );
    });

    it('applies both packable files and ignore rules together', async () => {
      vi.mocked(getPackableFiles).mockResolvedValue(
        new Set(['index.js', 'node_modules/dep/index.js', 'package.json'])
      );
      vi.mocked(shouldIgnoreFile).mockImplementation((filename: string) =>
        filename.startsWith('node_modules/')
      );
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const filter = directoryCalls[0].filter!;
      expect(filter({ name: 'index.js' } as EntryData)).toBeTruthy();
      expect(filter({ name: 'package.json' } as EntryData)).toBeTruthy();
      expect(filter({ name: 'node_modules/dep/index.js' } as EntryData)).toBe(
        false
      );
      expect(filter({ name: 'secret.txt' } as EntryData)).toBe(false);
    });

    it('skips packable check when packable files set is empty', async () => {
      vi.mocked(getPackableFiles).mockResolvedValue(new Set());
      vi.mocked(shouldIgnoreFile).mockReturnValue(false);
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const filter = directoryCalls[0].filter!;
      expect(filter({ name: 'any-file.txt' } as EntryData)).toBeTruthy();
      expect(
        filter({ name: 'deeply/nested/file.js' } as EntryData)
      ).toBeTruthy();
    });
  });

  describe('srcDir boundary detection', () => {
    it('treats workspace with similar path prefix as external', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src-backup/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(directoryCalls).toHaveLength(1);
      const entries = result.packageWorkspaces.get(
        '/project/src/app/package.json'
      );
      expect(entries![0]).toMatch(/^\.\.\/_workspaces\//);
    });

    it('treats workspace at srcDir root as internal', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(directoryCalls).toHaveLength(0);
    });

    it('treats file dep with similar path prefix as external', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: 'backup-utils',
          localPath: '/project/src-backup/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        fileDeps
      );

      expect(directoryCalls).toHaveLength(1);
      expect(result.packageFileDeps.size).toBe(1);
    });

    it('treats file dep inside srcDir as internal', async () => {
      const { archive, directoryCalls } = createMockArchive();
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: 'internal-pkg',
          localPath: '/project/src/shared/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        fileDeps
      );

      expect(directoryCalls).toHaveLength(0);
      expect(result.packageFileDeps.size).toBe(0);
    });
  });

  describe('deduplication across package.jsons', () => {
    it('stores same relative path when both package.jsons are at the same depth', async () => {
      const { archive } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app1/package.json',
        },
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app2/package.json',
        },
      ];

      const result = await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const entries1 = result.packageWorkspaces.get(
        '/project/src/app1/package.json'
      );
      const entries2 = result.packageWorkspaces.get(
        '/project/src/app2/package.json'
      );
      expect(entries1![0]).toBe(entries2![0]);
    });
  });

  describe('package.json updates', () => {
    it('updates workspaces and file dep paths in archive', async () => {
      const packageJsonPath = '/project/src/app/package.json';
      const originalPackageJson = {
        name: 'my-app',
        workspaces: ['../../packages/utils'],
        dependencies: {
          '@company/logger': 'file:../../external/logger',
          react: '^18.0.0',
        },
      };

      vi.spyOn(fs, 'existsSync').mockImplementation(p => p === packageJsonPath);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify(originalPackageJson)
      );

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: '@company/logger',
          localPath: '/external/logger',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        fileDeps
      );

      expect(appendCalls).toHaveLength(1);
      const written = JSON.parse(appendCalls[0].content);

      expect(written.workspaces).toHaveLength(1);
      expect(written.workspaces[0]).toMatch(
        /^\.\.\/_workspaces\/utils-[a-f0-9]{8}$/
      );

      expect(written.dependencies['@company/logger']).toMatch(
        /^file:\.\.\/_workspaces\/logger-[a-f0-9]{8}$/
      );
      expect(written.dependencies['react']).toBe('^18.0.0');
    });

    it('skips package.json update when file does not exist on disk', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(appendCalls).toHaveLength(0);
    });

    it('warns and appends raw content when package.json is malformed', async () => {
      const { uiLogger } = await import('../../ui/logger.js');
      const malformedContent = '{ invalid json';

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(malformedContent);

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: '/project/src/app/package.json',
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      expect(uiLogger.warn).toHaveBeenCalled();
      expect(appendCalls).toHaveLength(1);
      expect(appendCalls[0].content).toBe(malformedContent);
      expect(appendCalls[0].name).toBe('app/package.json');
    });
  });

  describe('lock file rewriting', () => {
    it('rewrites lock file paths for external workspace deps', async () => {
      const packageJsonPath = '/project/src/app/package.json';
      const lockfilePath = '/project/src/app/package-lock.json';
      const lockfileContent = {
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'my-app',
            workspaces: ['../../../external/utils'],
          },
          '../../../external/utils': { name: 'utils', version: '1.0.0' },
          'node_modules/utils': {
            resolved: '../../../external/utils',
            link: true,
          },
        },
      };

      vi.spyOn(fs, 'existsSync').mockImplementation(p => {
        return p === packageJsonPath || p === lockfilePath;
      });
      vi.spyOn(fs, 'readFileSync').mockImplementation(p => {
        if (p === packageJsonPath) {
          return JSON.stringify({
            name: 'my-app',
            workspaces: ['placeholder'],
          });
        }
        if (p === lockfilePath) {
          return JSON.stringify(lockfileContent);
        }
        return '';
      });

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const lockfileCall = appendCalls.find(
        c => c.name === 'app/package-lock.json'
      );
      expect(lockfileCall).toBeDefined();

      const rewritten = JSON.parse(lockfileCall!.content);
      const packages = rewritten.packages as Record<string, unknown>;

      // Old external path key should be gone
      expect(packages['../../../external/utils']).toBeUndefined();

      // New archive path key should exist
      const expectedArchivePath = computeExternalArchivePath('/external/utils');
      const newKey = path.relative(
        '/project/src/app',
        path.join(srcDir, expectedArchivePath)
      );
      expect(packages[newKey]).toBeDefined();

      // node_modules symlink resolved should be updated
      const symlink = packages['node_modules/utils'] as Record<string, unknown>;
      expect(symlink.resolved).toBe(newKey);

      // Root workspaces array should be updated
      const root = packages[''] as Record<string, unknown>;
      expect((root.workspaces as string[])[0]).toBe(newKey);
    });

    it('does not append lock file when no external deps exist', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const { archive, appendCalls } = createMockArchive();

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        []
      );

      expect(appendCalls).toHaveLength(0);
    });

    it('skips lock file when it does not exist on disk', async () => {
      const packageJsonPath = '/project/src/app/package.json';

      vi.spyOn(fs, 'existsSync').mockImplementation(p => p === packageJsonPath);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'my-app', workspaces: ['placeholder'] })
      );

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const lockfileCall = appendCalls.find(c =>
        c.name.endsWith('package-lock.json')
      );
      expect(lockfileCall).toBeUndefined();
    });

    it('rewrites lock file paths for external file: deps', async () => {
      const packageJsonPath = '/project/src/app/package.json';
      const lockfilePath = '/project/src/app/package-lock.json';
      const lockfileContent = {
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'my-app',
          },
          '../../../external/logger': {
            name: '@company/logger',
            version: '2.0.0',
          },
          'node_modules/@company/logger': {
            resolved: '../../../external/logger',
            link: true,
          },
        },
      };

      vi.spyOn(fs, 'existsSync').mockImplementation(p => {
        return p === packageJsonPath || p === lockfilePath;
      });
      vi.spyOn(fs, 'readFileSync').mockImplementation(p => {
        if (p === packageJsonPath) {
          return JSON.stringify({
            name: 'my-app',
            dependencies: {
              '@company/logger': 'file:../../../external/logger',
            },
          });
        }
        if (p === lockfilePath) {
          return JSON.stringify(lockfileContent);
        }
        return '';
      });

      const { archive, appendCalls } = createMockArchive();
      const fileDeps: FileDependencyMapping[] = [
        {
          packageName: '@company/logger',
          localPath: '/external/logger',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        [],
        fileDeps
      );

      const lockfileCall = appendCalls.find(
        c => c.name === 'app/package-lock.json'
      );
      expect(lockfileCall).toBeDefined();

      const rewritten = JSON.parse(lockfileCall!.content);
      const packages = rewritten.packages as Record<string, unknown>;

      expect(packages['../../../external/logger']).toBeUndefined();

      const expectedArchivePath =
        computeExternalArchivePath('/external/logger');
      const newKey = path.relative(
        '/project/src/app',
        path.join(srcDir, expectedArchivePath)
      );
      expect(packages[newKey]).toBeDefined();

      const symlink = packages['node_modules/@company/logger'] as Record<
        string,
        unknown
      >;
      expect(symlink.resolved).toBe(newKey);
    });

    it('skips lock file with malformed JSON gracefully', async () => {
      const packageJsonPath = '/project/src/app/package.json';
      const lockfilePath = '/project/src/app/package-lock.json';

      vi.spyOn(fs, 'existsSync').mockImplementation(p => {
        return p === packageJsonPath || p === lockfilePath;
      });
      vi.spyOn(fs, 'readFileSync').mockImplementation(p => {
        if (p === packageJsonPath) {
          return JSON.stringify({
            name: 'my-app',
            workspaces: ['placeholder'],
          });
        }
        if (p === lockfilePath) {
          return '{ invalid json';
        }
        return '';
      });

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const lockfileCall = appendCalls.find(c =>
        c.name.endsWith('package-lock.json')
      );
      expect(lockfileCall).toBeUndefined();
    });

    it('skips lock file rewriting when only internal deps exist', async () => {
      const packageJsonPath = '/project/src/app/package.json';

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'my-app', workspaces: ['placeholder'] })
      );

      const { archive, appendCalls } = createMockArchive();
      const workspaces: WorkspaceMapping[] = [
        {
          workspaceDir: '/project/src/packages/utils',
          sourcePackageJsonPath: packageJsonPath,
        },
      ];

      await archiveWorkspacesAndDependencies(
        archive,
        srcDir,
        projectDir,
        workspaces,
        []
      );

      const lockfileCall = appendCalls.find(c =>
        c.name.endsWith('package-lock.json')
      );
      expect(lockfileCall).toBeUndefined();
    });
  });
});

describe('rewriteLockfileForExternalDeps', () => {
  it('returns lockfile unchanged when no mappings provided', () => {
    const lockfile = {
      packages: {
        '': { name: 'my-app', workspaces: ['../shared-utils'] },
        '../shared-utils': { name: 'shared-utils', version: '1.0.0' },
        'node_modules/shared-utils': {
          resolved: '../shared-utils',
          link: true,
        },
      },
    };

    const result = rewriteLockfileForExternalDeps(lockfile, []);
    expect(result).toBe(lockfile);
  });

  it('renames packages key from old path to new path', () => {
    const lockfile = {
      packages: {
        '': { name: 'my-app' },
        '../shared-utils': { name: 'shared-utils', version: '1.0.0' },
      },
    };

    const result = rewriteLockfileForExternalDeps(lockfile, [
      {
        oldPath: '../shared-utils',
        newPath: '../../_workspaces/shared-utils-abc',
      },
    ]);

    const packages = result.packages as Record<string, unknown>;
    expect(packages['../shared-utils']).toBeUndefined();
    expect(packages['../../_workspaces/shared-utils-abc']).toBeDefined();
  });

  it('updates resolved field in node_modules symlink entry', () => {
    const lockfile = {
      packages: {
        '': { name: 'my-app' },
        '../shared-utils': { name: 'shared-utils', version: '1.0.0' },
        'node_modules/shared-utils': {
          resolved: '../shared-utils',
          link: true,
        },
      },
    };

    const result = rewriteLockfileForExternalDeps(lockfile, [
      {
        oldPath: '../shared-utils',
        newPath: '../../_workspaces/shared-utils-abc',
      },
    ]);

    const packages = result.packages as Record<string, unknown>;
    const symlink = packages['node_modules/shared-utils'] as Record<
      string,
      unknown
    >;
    expect(symlink.resolved).toBe('../../_workspaces/shared-utils-abc');
  });

  it('updates workspaces array in root packages entry', () => {
    const lockfile = {
      packages: {
        '': {
          name: 'my-app',
          workspaces: ['../shared-utils', '../other-pkg'],
        },
        '../shared-utils': { name: 'shared-utils' },
        '../other-pkg': { name: 'other-pkg' },
      },
    };

    const result = rewriteLockfileForExternalDeps(lockfile, [
      {
        oldPath: '../shared-utils',
        newPath: '../../_workspaces/shared-utils-abc',
      },
    ]);

    const packages = result.packages as Record<string, unknown>;
    const root = packages[''] as Record<string, unknown>;
    expect(root.workspaces).toEqual([
      '../../_workspaces/shared-utils-abc',
      '../other-pkg',
    ]);
  });

  it('handles multiple path mappings', () => {
    const lockfile = {
      packages: {
        '': { name: 'my-app' },
        '../utils': { name: 'utils' },
        '../logger': { name: 'logger' },
        'node_modules/utils': { resolved: '../utils', link: true },
        'node_modules/logger': { resolved: '../logger', link: true },
      },
    };

    const result = rewriteLockfileForExternalDeps(lockfile, [
      { oldPath: '../utils', newPath: '../../_workspaces/utils-aaa' },
      { oldPath: '../logger', newPath: '../../_workspaces/logger-bbb' },
    ]);

    const packages = result.packages as Record<string, unknown>;
    expect(packages['../../_workspaces/utils-aaa']).toBeDefined();
    expect(packages['../../_workspaces/logger-bbb']).toBeDefined();
    const utils = packages['node_modules/utils'] as Record<string, unknown>;
    const logger = packages['node_modules/logger'] as Record<string, unknown>;
    expect(utils.resolved).toBe('../../_workspaces/utils-aaa');
    expect(logger.resolved).toBe('../../_workspaces/logger-bbb');
  });

  it('returns unchanged lockfile when packages section is absent', () => {
    const lockfile = { name: 'my-app', lockfileVersion: 3 };

    const result = rewriteLockfileForExternalDeps(lockfile, [
      { oldPath: '../utils', newPath: '../../_workspaces/utils-aaa' },
    ]);

    expect(result).toBe(lockfile);
  });
});
