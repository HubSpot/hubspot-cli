import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import archiver from 'archiver';
import tmp from 'tmp';
import { vi } from 'vitest';
import { validateSourceDirectory, handleProjectUpload } from '../upload.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';
import { isV2Project } from '../platformVersion.js';
import ProjectValidationError from '../../errors/ProjectValidationError.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import { ProjectConfig } from '../../../types/Projects.js';
import { uploadProject } from '@hubspot/local-dev-lib/api/projects';
import { ensureProjectExists } from '../ensureProjectExists.js';
import { projectContainsHsMetaFiles } from '@hubspot/project-parsing-lib/projects';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';

// Mock dependencies
vi.mock('../../ui/SpinniesManager');
vi.mock('../platformVersion.js');
vi.mock('@hubspot/local-dev-lib/fs');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('../ensureProjectExists.js');
vi.mock('@hubspot/project-parsing-lib/projects');
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
      vi.mocked(isV2Project).mockReturnValue(true);
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
      vi.mocked(isV2Project).mockReturnValue(true);
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
      vi.mocked(isV2Project).mockReturnValue(true);
      const filePaths = [
        path.join(srcDir, 'component.js'),
        path.join(srcDir, 'config.json'),
      ];
      vi.mocked(walk).mockResolvedValue(filePaths);

      await validateSourceDirectory(srcDir, projectConfig, tempDir);

      expect(uiLogger.warn).not.toHaveBeenCalled();
    });

    it('should not warn about legacy files in non-V2 projects', async () => {
      vi.mocked(isV2Project).mockReturnValue(false);
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
      vi.mocked(isV2Project).mockReturnValue(false);
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
  });
});
