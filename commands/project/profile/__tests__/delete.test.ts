import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import profileDeleteCommand from '../delete.js';
import { getProjectConfig } from '../../../../lib/projects/config.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { uiLogger } from '../../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import { CommonArgs } from '../../../../types/Yargs.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import * as promptUtils from '../../../../lib/prompts/promptUtils.js';

vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/errorHandlers/index.js');
vi.mock('../../../../lib/projects/config');
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../../../lib/prompts/promptUtils');
vi.mock('../../../../lib/validation', () => ({
  fileExists: vi.fn().mockReturnValue(true),
}));
vi.mock('../../../../lib/yargs/makeYargsHandlerWithUsageTracking', () => ({
  makeYargsHandlerWithUsageTracking: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));
vi.mock('@hubspot/local-dev-lib/api/projects', () => ({
  fetchProject: vi.fn(),
  deleteProject: vi.fn(),
}));
vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getConfigAccountById: vi.fn(),
  };
});
vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    unlinkSync: vi.fn(),
  };
});

type ProjectProfileDeleteArgs = CommonArgs & {
  name?: string;
};

const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedIsLegacyProject = vi.mocked(isLegacyProject);
const mockedUiLogger = vi.mocked(uiLogger);
const mockedGetAllHsProfiles = vi.mocked(getAllHsProfiles);
const mockedListPrompt = vi.mocked(promptUtils.listPrompt);

const mockProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};

describe('commands/project/profile/delete', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(profileDeleteCommand.command).toEqual('delete [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(profileDeleteCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      profileDeleteCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockArgs = {
      name: 'qa',
      exit: mockExit,
    } as unknown as ArgumentsCamelCase<ProjectProfileDeleteArgs>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir: '/path/to/project',
      });
      mockedIsLegacyProject.mockReturnValue(false);
      mockedGetAllHsProfiles.mockResolvedValue(['qa']);
      mockedListPrompt.mockResolvedValue('qa');
    });

    it('should exit with error when no project config is found', async () => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await profileDeleteCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error for unsupported platform version', async () => {
      mockedIsLegacyProject.mockReturnValue(true);

      await profileDeleteCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedGetAllHsProfiles).not.toHaveBeenCalled();
    });
  });
});
