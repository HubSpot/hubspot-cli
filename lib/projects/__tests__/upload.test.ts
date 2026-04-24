import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import archiver from 'archiver';
import tmp from 'tmp';
import { vi } from 'vitest';
import { validateSourceDirectory, handleProjectUpload } from '../upload.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import ProjectValidationError from '../../errors/ProjectValidationError.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import { ProjectConfig } from '../../../types/Projects.js';
import { uploadProject } from '@hubspot/local-dev-lib/api/projects';
import { ensureProjectExists } from '../ensureProjectExists.js';
import { projectContainsHsMetaFiles } from '@hubspot/project-parsing-lib/projects';
import {
  findAndParsePackageJsonFiles,
  collectWorkspaceDirectories,
  collectFileDependencies,
} from '@hubspot/project-parsing-lib/workspaces';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';

// Mock dependencies
vi.mock('../../ui/SpinniesManager');
vi.mock('../platformVersion.js');
vi.mock('@hubspot/local-dev-lib/fs');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('../ensureProjectExists.js');
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('@hubspot/project-parsing-lib/workspaces', () => ({
  findAndParsePackageJsonFiles: vi.fn(),
  collectWorkspaceDirectories: vi.fn(),
  collectFileDependencies: vi.fn(),
  getPackableFiles: vi.fn(),
}));
vi.mock('@hubspot/local-dev-lib/ignoreRules');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('archiver');
vi.mock('tmp');
vi.mock('fs-extra', async () => {
  const actual = await vi.importActual<typeof import('fs-extra')>('fs-extra');
  return {
    ...actual,
    createWriteStream: vi.fn(),
  };
});

describe('lib/projects/upload', () => {
  describe('validateSourceDirectory', () => {
    let tempDir: string;
    let srcDir: string;
    let projectConfig: ProjectConfig;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
      srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      projectConfig = {
        name: 'test-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      };

      // Mock config to prevent reading actual config file
      vi.mocked(getConfigAccountIfExists).mockReturnValue(undefined);
    });

    afterEach(() => {
      fs.removeSync(tempDir);
    });

    it('should throw ProjectValidationError when source directory is empty', async () => {
      vi.mocked(walk).mockResolvedValue([]);

      await expect(
        validateSourceDirectory(srcDir, projectConfig, tempDir)
      ).rejects.toThrow(ProjectValidationError);

      expect(walk).toHaveBeenCalledWith(srcDir, ['node_modules']);
    });

    it('should warn about legacy files in V2 projects', async () => {
      vi.mocked(isLegacyProject).mockReturnValue(false);
      const legacyFilePath = path.join(srcDir, 'app', 'serverless.json');
      vi.mocked(walk).mockResolvedValue([legacyFilePath]);

      await validateSourceDirectory(srcDir, projectConfig, tempDir);

      expect(uiLogger.warn).toHaveBeenCalledWith(
        lib.projectUpload.handleProjectUpload.legacyFileDetected(
          'src/app/serverless.json',
          '2025.2'
        )
      );
    });

    it('should warn about multiple legacy files', async () => {
      vi.mocked(isLegacyProject).mockReturnValue(false);
      const filePaths = [
        path.join(srcDir, 'app1', 'serverless.json'),
        path.join(srcDir, 'app2', 'app.json'),
        path.join(srcDir, 'app3', 'public-app.json'),
      ];
      vi.mocked(walk).mockResolvedValue(filePaths);

      await validateSourceDirectory(srcDir, projectConfig, tempDir);

      expect(uiLogger.warn).toHaveBeenCalledTimes(3);
      expect(uiLogger.warn).toHaveBeenCalledWith(
        lib.projectUpload.handleProjectUpload.legacyFileDetected(
          'src/app1/serverless.json',
          '2025.2'
        )
      );
      expect(uiLogger.warn).toHaveBeenCalledWith(
        lib.projectUpload.handleProjectUpload.legacyFileDetected(
          'src/app2/app.json',
          '2025.2'
        )
      );
      expect(uiLogger.warn).toHaveBeenCalledWith(
        lib.projectUpload.handleProjectUpload.legacyFileDetected(
          'src/app3/public-app.json',
          '2025.2'
        )
      );
    });

    it('should not warn about non-legacy files', async () => {
      vi.mocked(isLegacyProject).mockReturnValue(false);
      const filePaths = [
        path.join(srcDir, 'component.js'),
        path.join(srcDir, 'config.json'),
      ];
      vi.mocked(walk).mockResolvedValue(filePaths);

      await validateSourceDirectory(srcDir, projectConfig, tempDir);

      expect(uiLogger.warn).not.toHaveBeenCalled();
    });

    it('should not warn about legacy files in non-V2 projects', async () => {
      vi.mocked(isLegacyProject).mockReturnValue(true);
      projectConfig.platformVersion = '2025.1';
      const filePaths = [
        path.join(srcDir, 'app', 'serverless.json'),
        path.join(srcDir, 'app', 'app.json'),
      ];
      vi.mocked(walk).mockResolvedValue(filePaths);

      await validateSourceDirectory(srcDir, projectConfig, tempDir);

      expect(uiLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('handleProjectUpload', () => {
    let tempDir: string;
    let projectConfig: ProjectConfig;
    let mockWriteStream: { on: ReturnType<typeof vi.fn> };
    let mockArchive: {
      pipe: ReturnType<typeof vi.fn>;
      directory: ReturnType<typeof vi.fn>;
      finalize: ReturnType<typeof vi.fn>;
      pointer: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'test.js'), 'test content');

      projectConfig = {
        name: 'test-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      };

      // Mock config to prevent reading actual config file
      vi.mocked(getConfigAccountIfExists).mockReturnValue(undefined);

      vi.mocked(walk).mockResolvedValue([path.join(srcDir, 'test.js')]);
      vi.mocked(shouldIgnoreFile).mockReturnValue(false);
      vi.mocked(projectContainsHsMetaFiles).mockResolvedValue(false);
      vi.mocked(isLegacyProject).mockReturnValue(true);

      // Mock workspace functions to return empty arrays
      vi.mocked(findAndParsePackageJsonFiles).mockResolvedValue([]);
      vi.mocked(collectWorkspaceDirectories).mockResolvedValue([]);
      vi.mocked(collectFileDependencies).mockResolvedValue([]);
      vi.mocked(tmp.fileSync).mockReturnValue({
        name: path.join(tempDir, 'test.zip'),
        fd: 1,
        removeCallback: vi.fn(),
      } as tmp.FileResult);

      // Store close callback so archive.finalize() can trigger it
      let closeCallback: (() => void) | undefined;
      mockWriteStream = {
        on: vi.fn((event: string, callback: () => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
      };
      vi.spyOn(fs, 'createWriteStream').mockReturnValue(
        mockWriteStream as unknown as fs.WriteStream
      );

      mockArchive = {
        pipe: vi.fn(),
        directory: vi.fn(),
        finalize: vi.fn(() => {
          // Trigger the close event when finalize is called
          if (closeCallback) {
            process.nextTick(closeCallback);
          }
        }),
        pointer: vi.fn().mockReturnValue(100),
        on: vi.fn(),
      };
      vi.mocked(archiver).mockReturnValue(
        mockArchive as unknown as archiver.Archiver
      );
    });

    afterEach(() => {
      fs.removeSync(tempDir);
    });

    it('should upload project files and call callback when project exists', async () => {
      const accountId = 123;
      const buildId = 456;
      const callbackResult = { success: true };
      const callbackFunc = vi.fn().mockResolvedValue(callbackResult);

      vi.mocked(ensureProjectExists).mockResolvedValue({
        projectExists: true,
      });

      vi.mocked(uploadProject).mockResolvedValue({
        data: { buildId },
      } as Awaited<ReturnType<typeof uploadProject>>);

      const uploadPromise = handleProjectUpload({
        accountId,
        projectConfig,
        projectDir: tempDir,
        callbackFunc,
        isUploadCommand: true,
      });

      // Trigger the close event by calling finalize
      mockArchive.finalize();

      const result = await uploadPromise;

      expect(uploadProject).toHaveBeenCalled();
      expect(callbackFunc).toHaveBeenCalled();
      expect(result.result).toEqual(callbackResult);
    });

    it('should exclude modified package.json files from directory walk to prevent duplicate zip entries', async () => {
      const srcDir = path.join(tempDir, 'src');

      vi.mocked(isLegacyProject).mockReturnValue(false);
      vi.mocked(collectWorkspaceDirectories).mockResolvedValue([
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: path.join(
            srcDir,
            'app/functions/package.json'
          ),
        },
      ]);

      vi.mocked(ensureProjectExists).mockResolvedValue({
        projectExists: true,
      });

      vi.mocked(uploadProject).mockResolvedValue({
        data: { buildId: 1 },
      } as Awaited<ReturnType<typeof uploadProject>>);

      const uploadPromise = handleProjectUpload({
        accountId: 123,
        projectConfig,
        projectDir: tempDir,
        callbackFunc: vi.fn().mockResolvedValue({}),
        isUploadCommand: true,
      });

      mockArchive.finalize();
      await uploadPromise;

      const srcDirCall = mockArchive.directory.mock.calls[0];
      expect(srcDirCall[1]).toBe(false);
      const filterFn = srcDirCall[2];

      expect(filterFn({ name: 'app/functions/package.json' })).toBe(false);
      expect(filterFn({ name: 'app/functions/index.js' })).toBeTruthy();
      expect(filterFn({ name: 'other/package.json' })).toBeTruthy();
    });

    it('should exclude lock files for dirs with external deps from directory walk', async () => {
      const srcDir = path.join(tempDir, 'src');
      const lockfilePath = path.join(srcDir, 'app/functions/package-lock.json');

      vi.mocked(isLegacyProject).mockReturnValue(false);
      vi.mocked(collectWorkspaceDirectories).mockResolvedValue([
        {
          workspaceDir: '/external/utils',
          sourcePackageJsonPath: path.join(
            srcDir,
            'app/functions/package.json'
          ),
        },
      ]);

      // Lock file must exist on disk for getLockfilePathsToUpdate to include it
      const originalExistsSync = fs.existsSync;
      vi.spyOn(fs, 'existsSync').mockImplementation(p => {
        if (p === lockfilePath) return true;
        return originalExistsSync(p as string);
      });

      vi.mocked(ensureProjectExists).mockResolvedValue({
        projectExists: true,
      });

      vi.mocked(uploadProject).mockResolvedValue({
        data: { buildId: 1 },
      } as Awaited<ReturnType<typeof uploadProject>>);

      const uploadPromise = handleProjectUpload({
        accountId: 123,
        projectConfig,
        projectDir: tempDir,
        callbackFunc: vi.fn().mockResolvedValue({}),
        isUploadCommand: true,
      });

      mockArchive.finalize();
      await uploadPromise;

      const srcDirCall = mockArchive.directory.mock.calls[0];
      const filterFn = srcDirCall[2];

      expect(filterFn({ name: 'app/functions/package-lock.json' })).toBe(false);
      expect(filterFn({ name: 'app/functions/index.js' })).toBeTruthy();
      expect(filterFn({ name: 'other/package-lock.json' })).toBeTruthy();
    });

    it('should skip workspace collection for pre-v2 platform versions', async () => {
      projectConfig.platformVersion = '2025.1';
      vi.mocked(isLegacyProject).mockReturnValue(true);

      vi.mocked(ensureProjectExists).mockResolvedValue({
        projectExists: true,
      });

      vi.mocked(uploadProject).mockResolvedValue({
        data: { buildId: 1 },
      } as Awaited<ReturnType<typeof uploadProject>>);

      const uploadPromise = handleProjectUpload({
        accountId: 123,
        projectConfig,
        projectDir: tempDir,
        callbackFunc: vi.fn().mockResolvedValue({}),
        isUploadCommand: true,
      });

      mockArchive.finalize();
      await uploadPromise;

      expect(findAndParsePackageJsonFiles).not.toHaveBeenCalled();
      expect(collectWorkspaceDirectories).not.toHaveBeenCalled();
      expect(collectFileDependencies).not.toHaveBeenCalled();
    });
  });
});
