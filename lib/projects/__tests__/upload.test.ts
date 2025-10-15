import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { vi } from 'vitest';
import { validateSourceDirectory } from '../upload.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';
import { isV2Project } from '../platformVersion.js';
import ProjectValidationError from '../../errors/ProjectValidationError.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import { ProjectConfig } from '../../../types/Projects.js';

// Mock dependencies
vi.mock('../../ui/logger.js');
vi.mock('../platformVersion.js');
vi.mock('@hubspot/local-dev-lib/fs');

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

      vi.clearAllMocks();
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
});
