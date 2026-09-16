import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import projectListCommand, { type ProjectListArgs } from '../list.js';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError } from '../../../lib/errorHandlers/index.js';
import { renderTable } from '../../../ui/render.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { ProjectListSchema } from '../../../lib/jsonOutput/projectList.js';

// Capture the arguments the command passes to makeWrappedYargsHandler at
// import time. A plain array (not a vi mock) survives clearMocks so the
// import-time call can still be asserted inside a test.
const { wrapperCalls } = vi.hoisted(() => ({
  wrapperCalls: [] as unknown[][],
}));

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../ui/render.js');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/yargs/makeWrappedYargsHandler', () => ({
  makeWrappedYargsHandler: (...args: unknown[]) => {
    wrapperCalls.push(args);
    return args[1];
  },
}));

const mockedFetchProjects = vi.mocked(fetchProjects);
const mockedRenderTable = vi.mocked(renderTable);
const mockedUiLogger = vi.mocked(uiLogger);

const mockProjects = [
  {
    id: 1,
    name: 'project-one',
    isLocked: false,
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
    deployedBuildId: 4,
    latestBuild: { buildId: 5, platformVersion: '2025.2' },
  },
  {
    id: 2,
    name: 'project-two',
    isLocked: true,
    createdAt: 1700000002000,
    updatedAt: 1700000003000,
  },
];

describe('commands/project/list', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectListCommand.command).toEqual(['list', 'ls']);
    });

    it('should register the JSON output schema with the wrapped handler', () => {
      const call = wrapperCalls.find(args => args[0] === 'project-list');

      expect(call).toBeDefined();
      expect(call?.[2]).toEqual({ jsonOutputSchema: ProjectListSchema });
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectListCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectListCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectListCommand.builder(yargsMock);

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
    } as unknown as ArgumentsCamelCase<ProjectListArgs>;

    beforeEach(() => {
      mockedFetchProjects.mockResolvedValue({
        data: { results: mockProjects },
      } as unknown as Awaited<ReturnType<typeof fetchProjects>>);
    });

    it('should render a table when not in JSON mode', async () => {
      await projectListCommand.handler(mockArgs);

      expect(mockedRenderTable).toHaveBeenCalledTimes(1);
      expect(mockAddJsonOutput).not.toHaveBeenCalled();
    });

    it('should exit with error when no projects are found', async () => {
      mockedFetchProjects.mockResolvedValue({
        data: { results: [] },
      } as unknown as Awaited<ReturnType<typeof fetchProjects>>);

      await projectListCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedRenderTable).not.toHaveBeenCalled();
    });

    it('should exit with error when the fetch fails', async () => {
      mockedFetchProjects.mockRejectedValue(new Error('boom'));

      await projectListCommand.handler(mockArgs);

      expect(logError).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should output mapped JSON when formatOutputAsJson is true', async () => {
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectListArgs>;

      await projectListCommand.handler(jsonArgs);

      expect(mockAddJsonOutput).toHaveBeenCalledWith({
        accountId: 100,
        results: [
          {
            name: 'project-one',
            id: 1,
            createdAt: 1700000000000,
            updatedAt: 1700000001000,
            platformVersion: '2025.2',
            latestBuildId: 5,
            deployedBuildId: 4,
            isLocked: false,
          },
          {
            name: 'project-two',
            id: 2,
            createdAt: 1700000002000,
            updatedAt: 1700000003000,
            platformVersion: undefined,
            latestBuildId: undefined,
            deployedBuildId: undefined,
            isLocked: true,
          },
        ],
      });
      expect(mockedRenderTable).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should output empty results JSON and succeed when no projects are found', async () => {
      mockedFetchProjects.mockResolvedValue({
        data: { results: [] },
      } as unknown as Awaited<ReturnType<typeof fetchProjects>>);

      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectListArgs>;

      await projectListCommand.handler(jsonArgs);

      expect(mockAddJsonOutput).toHaveBeenCalledWith({
        accountId: 100,
        results: [],
      });
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedUiLogger.error).not.toHaveBeenCalled();
    });
  });
});
