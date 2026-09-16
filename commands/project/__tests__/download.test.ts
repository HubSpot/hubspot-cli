import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import projectDownloadCommand, {
  type ProjectDownloadArgs,
} from '../download.js';
import {
  downloadProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { getIsInProject } from '../../../lib/projects/config.js';
import { downloadProjectPrompt } from '../../../lib/prompts/downloadProjectPrompt.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/projects/config.js');
vi.mock('../../../lib/prompts/downloadProjectPrompt.js');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/archive', () => ({
  extractZipArchive: vi.fn().mockResolvedValue(true),
}));
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn(() => '/cwd'),
  sanitizeFileName: vi.fn((name: string) => name),
}));
vi.mock('../../../lib/errors/PromptExitError.js', () => ({
  isPromptExitError: vi.fn(() => false),
}));
vi.mock('../../../lib/yargs/makeWrappedYargsHandler', () => ({
  makeWrappedYargsHandler: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));

const mockedGetIsInProject = vi.mocked(getIsInProject);
const mockedDownloadProjectPrompt = vi.mocked(downloadProjectPrompt);
const mockedFetchProjectBuilds = vi.mocked(fetchProjectBuilds);
const mockedDownloadProject = vi.mocked(downloadProject);
const mockedExtractZipArchive = vi.mocked(extractZipArchive);
const mockedUiLogger = vi.mocked(uiLogger);

describe('commands/project/download', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectDownloadCommand.command).toEqual('download');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectDownloadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectDownloadCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project, dest, and build options', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectDownloadCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
          dest: expect.any(Object),
          build: expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockAddJsonOutput = vi.fn();
    const mockArgs = {
      derivedAccountId: 100,
      formatOutputAsJson: false,
      exit: mockExit,
      addUsageMetadata: vi.fn(),
      addJsonOutput: mockAddJsonOutput,
    } as unknown as ArgumentsCamelCase<ProjectDownloadArgs>;

    beforeEach(() => {
      mockedGetIsInProject.mockReturnValue(false);
      mockedDownloadProjectPrompt.mockResolvedValue({ project: 'myProject' });
      mockedFetchProjectBuilds.mockResolvedValue({
        data: { results: [{ buildId: 7 }] },
      } as unknown as Awaited<ReturnType<typeof fetchProjectBuilds>>);
      mockedDownloadProject.mockResolvedValue({
        data: Buffer.from('zip'),
      } as unknown as Awaited<ReturnType<typeof downloadProject>>);
    });

    it('should error when run inside an existing project', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedDownloadProject).not.toHaveBeenCalled();
    });

    it('should download, log success, and add JSON output', async () => {
      await projectDownloadCommand.handler(mockArgs);

      expect(mockedExtractZipArchive).toHaveBeenCalledTimes(1);
      expect(mockAddJsonOutput).toHaveBeenCalledWith({
        projectName: 'myProject',
        buildId: 7,
        dest: '/cwd/myProject',
      });
      expect(mockedUiLogger.log).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
