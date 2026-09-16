import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addJSONOutputOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { validateProject, toIssue } from '../../../lib/projects/validate.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { commands } from '../../../lang/en.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import projectValidateCommand, { ProjectValidateArgs } from '../validate.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/projects/validate');
vi.mock('../../../lib/errorHandlers');
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('@hubspot/local-dev-lib/config');

const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedIsLegacyProject = vi.mocked(isLegacyProject);
const mockedGetConfigAccountById = vi.mocked(getConfigAccountById);
const mockedValidateProject = vi.mocked(validateProject);
const mockedToIssue = vi.mocked(toIssue);
const processExitSpy = vi.spyOn(process, 'exit');

const projectDir = '/path/to/project';

const mockProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};

const mockAccountConfig = {
  accountType: 'STANDARD',
  accountId: 123,
} as HubSpotConfigAccount;

describe('commands/project/validate', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectValidateCommand.command).toEqual('validate');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectValidateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectValidateCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
      expect(addJSONOutputOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define a profile option and examples', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectValidateCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ profile: expect.any(Object) })
      );
      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<ProjectValidateArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: 123,
      } as ArgumentsCamelCase<ProjectValidateArgs>;

      mockedGetConfigAccountById.mockReturnValue(mockAccountConfig);
      mockedGetProjectConfig.mockReturnValue({
        projectConfig: mockProjectConfig,
        projectDir,
      });
      mockedIsLegacyProject.mockReturnValue(false);
      mockedValidateProject.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        profiles: [],
      });
      mockedToIssue.mockImplementation((error: unknown, profile?: string) =>
        profile
          ? {
              message: error instanceof Error ? error.message : String(error),
              profile,
            }
          : { message: error instanceof Error ? error.message : String(error) }
      );

      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
    });

    it('should exit with an error when the project config cannot be loaded', async () => {
      const error = new Error('No project config found');
      mockedGetProjectConfig.mockImplementation(() => {
        throw error;
      });

      await projectValidateCommand.handler(args);

      expect(logError).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedValidateProject).not.toHaveBeenCalled();
    });

    it('should exit with an error for legacy projects', async () => {
      mockedIsLegacyProject.mockReturnValue(true);

      await projectValidateCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.validate.badVersion
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedValidateProject).not.toHaveBeenCalled();
    });

    it('should delegate to validateProject with the project and flags', async () => {
      args.profile = 'dev';
      args.formatOutputAsJson = true;

      await projectValidateCommand.handler(args);

      expect(mockedValidateProject).toHaveBeenCalledWith({
        projectConfig: mockProjectConfig,
        projectDir,
        derivedAccountId: 123,
        profile: 'dev',
        formatOutputAsJson: true,
      });
    });

    it('should log success and exit successfully when valid', async () => {
      await projectValidateCommand.handler(args);

      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.project.validate.success(mockProjectConfig.name)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with an error and skip success output when invalid', async () => {
      mockedValidateProject.mockResolvedValue({
        valid: false,
        errors: [{ message: 'bad' }],
        warnings: [],
        profiles: [],
      });

      await projectValidateCommand.handler(args);

      expect(uiLogger.success).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should track command usage with the account type', async () => {
      await projectValidateCommand.handler(args);

      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-validate',
        expect.objectContaining({ type: 'STANDARD' }),
        123
      );
    });

    describe('--json output', () => {
      beforeEach(() => {
        args.formatOutputAsJson = true;
      });

      it('should output schema-valid JSON with the validation result', async () => {
        mockedValidateProject.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [
            { message: 'Legacy config file', file: 'src/serverless.json' },
          ],
          profiles: [{ name: 'dev', accountId: 456, valid: true }],
        });

        await projectValidateCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledTimes(1);
        expect(uiLogger.json).toHaveBeenCalledWith({
          valid: true,
          projectName: mockProjectConfig.name,
          platformVersion: mockProjectConfig.platformVersion,
          errors: [],
          warnings: [
            { message: 'Legacy config file', file: 'src/serverless.json' },
          ],
          profiles: [{ name: 'dev', accountId: 456, valid: true }],
        });
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should still emit JSON when the project config cannot be loaded', async () => {
        mockedGetProjectConfig.mockImplementation(() => {
          throw new Error('No project config found');
        });

        await projectValidateCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledWith({
          valid: false,
          errors: [{ message: 'No project config found' }],
          warnings: [],
        });
        expect(uiLogger.error).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should still emit JSON when the account lookup throws', async () => {
        mockedGetConfigAccountById.mockImplementation(() => {
          throw new Error('Stale configured account');
        });

        await projectValidateCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledWith({
          valid: false,
          errors: [{ message: 'Stale configured account' }],
          warnings: [],
        });
        expect(mockedValidateProject).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should still emit JSON when validateProject throws unexpectedly', async () => {
        mockedValidateProject.mockRejectedValue(new Error('unexpected boom'));

        await projectValidateCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledWith({
          valid: false,
          projectName: mockProjectConfig.name,
          platformVersion: mockProjectConfig.platformVersion,
          errors: [{ message: 'unexpected boom' }],
          warnings: [],
        });
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });
    });
  });
});
