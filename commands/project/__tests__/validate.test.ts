import path from 'path';
import { MockInstance, vi } from 'vitest';
import { ArgumentsCamelCase } from 'yargs';
import { validateSourceDirectory } from '../../../lib/projects/upload.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { commands } from '../../../lang/en.js';
import { isV2Project } from '../../../lib/projects/platformVersion.js';
import { loadAndValidateProfile } from '../../../lib/projectProfiles.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { handleTranslate } from '../../../lib/projects/upload.js';
import { CommonArgs } from '../../../types/Yargs.js';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import projectValidateCommand from '../validate.js';

type ProjectValidateArgs = CommonArgs & {
  profile?: string;
};

// Mock dependencies
vi.mock('../../../lib/projects/upload.js');
vi.mock('../../../lib/projects/config.js');
vi.mock('../../../lib/ui/logger.js');
vi.mock('../../../lib/usageTracking.js');
vi.mock('../../../lib/projectProfiles.js');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/projects/platformVersion.js');

describe('commands/project/validate', () => {
  const projectDir = '/test/project';
  let exitSpy: MockInstance;

  beforeEach(() => {
    // Mock process.exit to throw to stop execution
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`Process exited with code ${code}`);
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('project configuration validation', () => {
    it('should exit with error when project config is null', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await expect(
        // @ts-expect-error partial mock
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        })
      ).rejects.toThrow('Process exited with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.validate.mustBeRanWithinAProject
      );
    });

    it('should exit with error when project directory is null', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: {
          name: 'test',
          srcDir: 'src',
          platformVersion: '2025.2',
        },
        projectDir: null,
      });

      await expect(
        // @ts-expect-error partial mock
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        })
      ).rejects.toThrow('Process exited with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.validate.mustBeRanWithinAProject
      );
    });
  });

  it('should call validateSourceDirectory with correct parameters', async () => {
    const mockProjectConfig = {
      name: 'test-project',
      srcDir: 'src',
      platformVersion: '2025.2',
    };

    vi.mocked(getProjectConfig).mockResolvedValue({
      projectConfig: mockProjectConfig,
      projectDir,
    });
    vi.mocked(isV2Project).mockReturnValue(true);
    vi.mocked(validateProjectConfig).mockReturnValue(undefined);
    vi.mocked(loadAndValidateProfile).mockResolvedValue(123);
    vi.mocked(getAccountConfig).mockReturnValue({
      accountType: 'STANDARD',
      accountId: 123,
      env: 'prod',
    } as CLIAccount);
    vi.mocked(trackCommandUsage);
    vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);
    vi.mocked(handleTranslate).mockResolvedValue(undefined);

    await expect(
      projectValidateCommand.handler({
        derivedAccountId: 123,
        d: false,
        debug: false,
      } as ArgumentsCamelCase<ProjectValidateArgs>)
    ).rejects.toThrow('Process exited with code 0');

    const expectedSrcDir = path.resolve(projectDir, mockProjectConfig.srcDir);
    expect(validateSourceDirectory).toHaveBeenCalledWith(
      expectedSrcDir,
      mockProjectConfig,
      projectDir
    );
  });
});
