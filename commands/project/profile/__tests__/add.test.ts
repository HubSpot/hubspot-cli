import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import profileAddCommand from '../add.js';
import { getProjectConfig } from '../../../../lib/projects/config.js';
import { isV2Project } from '../../../../lib/projects/platformVersion.js';
import { uiLogger } from '../../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import { CommonArgs } from '../../../../types/Yargs.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import {
  getConfigAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import * as promptUtils from '../../../../lib/prompts/promptUtils.js';
import { fileExists } from '../../../../lib/validation.js';

vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/errorHandlers/index.js');
vi.mock('../../../../lib/projects/config');
vi.mock('../../../../lib/projects/platformVersion');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../../../lib/prompts/promptUtils');
vi.mock('../../../../lib/validation');
vi.mock('../../../../lib/yargs/makeYargsHandlerWithUsageTracking', () => ({
  makeYargsHandlerWithUsageTracking: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));
vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getConfigAccountIfExists: vi.fn(),
    getAllConfigAccounts: vi.fn(),
  };
});
vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

type ProjectProfileAddArgs = CommonArgs & {
  name?: string;
  targetAccount?: number;
};

const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedIsV2Project = vi.mocked(isV2Project);
const mockedUiLogger = vi.mocked(uiLogger);
const mockedGetAllHsProfiles = vi.mocked(getAllHsProfiles);
const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedGetConfigAccountIfExists = vi.mocked(getConfigAccountIfExists);
const mockedPromptUser = vi.mocked(promptUtils.promptUser);
const mockedListPrompt = vi.mocked(promptUtils.listPrompt);
const mockedFileExists = vi.mocked(fileExists);

const mockProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};

describe('commands/project/profile/add', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(profileAddCommand.command).toEqual('add [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(profileAddCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      profileAddCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockArgs = {
      name: 'qa',
      targetAccount: 100,
      exit: mockExit,
    } as unknown as ArgumentsCamelCase<ProjectProfileAddArgs>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir: '/path/to/project',
      });
      mockedIsV2Project.mockReturnValue(true);
      mockedGetAllHsProfiles.mockResolvedValue([]);
      mockedGetAllConfigAccounts.mockReturnValue([
        {
          accountId: 100,
          name: 'Test Account',
          accountType: 'STANDARD',
        },
      ] as ReturnType<typeof getAllConfigAccounts>);
      mockedGetConfigAccountIfExists.mockReturnValue({
        accountId: 100,
        name: 'Test Account',
        accountType: 'STANDARD',
      } as ReturnType<typeof getConfigAccountIfExists>);
      mockedPromptUser.mockResolvedValue({ name: 'qa' });
      mockedListPrompt.mockResolvedValue(100);
      mockedFileExists.mockReturnValue(false);
    });

    it('should exit with error when no project config is found', async () => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await profileAddCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error for unsupported platform version', async () => {
      mockedIsV2Project.mockReturnValue(false);

      await profileAddCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedGetAllConfigAccounts).not.toHaveBeenCalled();
    });
  });
});
