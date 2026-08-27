import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import {
  addAccountOptions,
  addConfigOptions,
  addJSONOutputOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import * as projectConfigUtils from '../../../lib/projects/config.js';
import { getProjectDetailUrl } from '../../../lib/projects/urls.js';
import { renderTable } from '../../../ui/render.js';
import { promptUser } from '../../../lib/prompts/promptUtils.js';
import { PromptExitError } from '../../../lib/errors/PromptExitError.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  mockHubSpotHttpResponse,
  mockHubSpotHttpError,
} from '../../../lib/testUtils.js';
import projectListBuildsCommand, {
  ProjectListBuildsArgs,
} from '../listBuilds.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/projects/urls');
vi.mock('../../../ui/render.js');
vi.mock('../../../lib/prompts/promptUtils');
vi.mock('../../../lib/errorHandlers');

const mockedFetchProject = vi.mocked(fetchProject);
const mockedFetchProjectBuilds = vi.mocked(fetchProjectBuilds);
const mockedRenderTable = vi.mocked(renderTable);
const getProjectConfigSpy = vi.spyOn(projectConfigUtils, 'getProjectConfig');
const validateProjectConfigSpy = vi.spyOn(
  projectConfigUtils,
  'validateProjectConfig'
);
const processExitSpy = vi.spyOn(process, 'exit');

const build = {
  buildId: 1,
  status: 'SUCCESS',
  finishedAt: '2026-02-20T15:30:10.000Z',
  enqueuedAt: '2026-02-20T15:30:00.000Z',
  subbuildStatuses: [],
};

const detailedBuild = {
  buildId: 2,
  status: 'SUCCESS',
  createdAt: '2026-02-20T15:29:59.000Z',
  enqueuedAt: '2026-02-20T15:30:00.000Z',
  startedAt: '2026-02-20T15:30:01.000Z',
  finishedAt: '2026-02-20T15:30:10.000Z',
  isAutoDeployEnabled: true,
  deployableState: 'DEPLOYABLE',
  platformVersion: '2025.2',
  uploadMessage: 'Initial upload',
  subbuildStatuses: [
    {
      buildName: 'app',
      buildType: 'APP',
      status: 'FAILURE',
      errorMessage: 'Build failed',
      startedAt: '2026-02-20T15:30:02.000Z',
      finishedAt: '2026-02-20T15:30:05.000Z',
      rootPath: 'src/app',
      id: 'sub-1',
      visible: true,
    },
  ],
};

function buildsResponse(
  results: unknown[],
  after?: string
): ReturnType<typeof fetchProjectBuilds> {
  return mockHubSpotHttpResponse({
    results,
    paging: after ? { next: { after } } : null,
  });
}

describe('commands/project/listBuilds', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectListBuildsCommand.command).toEqual('list-builds');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectListBuildsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectListBuildsCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);

      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project and a numeric limit option', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectListBuildsCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
          limit: expect.objectContaining({ type: 'number' }),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<ProjectListBuildsArgs>;
    const originalIsTTY = process.stdin.isTTY;

    beforeEach(() => {
      args = {
        derivedAccountId: 123456789,
        project: 'my-project',
      } as ArgumentsCamelCase<ProjectListBuildsArgs>;

      mockedFetchProject.mockReset();
      mockedFetchProjectBuilds.mockReset();
      mockedRenderTable.mockReset();
      vi.mocked(promptUser).mockReset();

      // Default to an interactive terminal so pagination prompts are exercised.
      process.stdin.isTTY = true;

      vi.mocked(getProjectDetailUrl).mockReturnValue(
        'https://app.hubspot.com/project'
      );
      mockedFetchProject.mockReturnValue(
        mockHubSpotHttpResponse({ name: 'my-project', deployedBuildId: 2 })
      );
      mockedFetchProjectBuilds.mockReturnValue(buildsResponse([build]));

      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
    });

    afterEach(() => {
      process.stdin.isTTY = originalIsTTY;
    });

    it('should render a table of builds when builds exist', async () => {
      await projectListBuildsCommand.handler(args);

      expect(mockedFetchProjectBuilds).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        { limit: undefined }
      );
      expect(mockedRenderTable).toHaveBeenCalledTimes(1);
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Showing the most')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should show a no-builds message and skip the table when empty', async () => {
      mockedFetchProjectBuilds.mockReturnValue(buildsResponse([]));

      await projectListBuildsCommand.handler(args);

      expect(mockedRenderTable).not.toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('No builds')
      );
    });

    it('should not show a next-builds count for an empty paginated page', async () => {
      mockedFetchProjectBuilds
        .mockReturnValueOnce(buildsResponse([build], 'CURSOR'))
        .mockReturnValueOnce(buildsResponse([]));

      await projectListBuildsCommand.handler(args);

      expect(mockedFetchProjectBuilds).toHaveBeenCalledTimes(2);
      expect(promptUser).toHaveBeenCalledTimes(1);
      expect(uiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Showing the next')
      );
    });

    it('should show the next-builds count when a paginated page has builds', async () => {
      mockedFetchProjectBuilds
        .mockReturnValueOnce(buildsResponse([build], 'CURSOR'))
        .mockReturnValueOnce(buildsResponse([build]));

      await projectListBuildsCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Showing the next')
      );
    });

    it('should not prompt for more builds when a limit is provided', async () => {
      args.limit = 5;
      mockedFetchProjectBuilds.mockReturnValue(
        buildsResponse([build], 'CURSOR')
      );

      await projectListBuildsCommand.handler(args);

      expect(mockedFetchProjectBuilds).toHaveBeenCalledTimes(1);
      expect(mockedFetchProjectBuilds).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        { limit: 5 }
      );
      expect(promptUser).not.toHaveBeenCalled();
    });

    it('should not prompt for more builds when output is non-interactive', async () => {
      process.stdin.isTTY = false;
      mockedFetchProjectBuilds.mockReturnValue(
        buildsResponse([build], 'CURSOR')
      );

      await projectListBuildsCommand.handler(args);

      expect(mockedFetchProjectBuilds).toHaveBeenCalledTimes(1);
      expect(promptUser).not.toHaveBeenCalled();
    });

    it('should read the project config when no project flag is provided', async () => {
      delete args.project;
      getProjectConfigSpy.mockResolvedValue({
        projectConfig: {
          name: 'config-project',
          srcDir: 'src',
          platformVersion: '2025.2',
        },
        projectDir: '/path/to/project',
      });
      validateProjectConfigSpy.mockImplementation(() => {});

      await projectListBuildsCommand.handler(args);

      expect(getProjectConfigSpy).toHaveBeenCalledTimes(1);
      expect(mockedFetchProject).toHaveBeenCalledWith(
        args.derivedAccountId,
        'config-project'
      );
    });

    describe('--json output', () => {
      beforeEach(() => {
        args.json = true;
      });

      it('should output schema-valid JSON and exit successfully', async () => {
        mockedFetchProjectBuilds.mockReturnValue(
          buildsResponse([detailedBuild])
        );

        await projectListBuildsCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledTimes(1);
        expect(uiLogger.json).toHaveBeenCalledWith({
          projectName: 'my-project',
          deployedBuildId: 2,
          results: [
            {
              buildId: 2,
              status: 'SUCCESS',
              isDeployed: true,
              isAutoDeployEnabled: true,
              deployableState: 'DEPLOYABLE',
              platformVersion: '2025.2',
              uploadMessage: 'Initial upload',
              enqueuedAt: '2026-02-20T15:30:00.000Z',
              startedAt: '2026-02-20T15:30:01.000Z',
              finishedAt: '2026-02-20T15:30:10.000Z',
              createdAt: '2026-02-20T15:29:59.000Z',
              subbuildStatuses: [
                {
                  buildName: 'app',
                  buildType: 'APP',
                  status: 'FAILURE',
                  errorMessage: 'Build failed',
                  startedAt: '2026-02-20T15:30:02.000Z',
                  finishedAt: '2026-02-20T15:30:05.000Z',
                  rootPath: 'src/app',
                  id: 'sub-1',
                  visible: true,
                },
              ],
            },
          ],
        });
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should include the paging cursor when more builds exist', async () => {
        mockedFetchProjectBuilds.mockReturnValue(
          buildsResponse([detailedBuild], 'NEXT_CURSOR')
        );

        await projectListBuildsCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledWith(
          expect.objectContaining({
            paging: { next: { after: 'NEXT_CURSOR' } },
          })
        );
      });

      it('should not prompt for pagination or render a table', async () => {
        mockedFetchProjectBuilds.mockReturnValue(
          buildsResponse([detailedBuild], 'NEXT_CURSOR')
        );

        await projectListBuildsCommand.handler(args);

        expect(promptUser).not.toHaveBeenCalled();
        expect(mockedRenderTable).not.toHaveBeenCalled();
      });

      it('should omit paging and stay schema-valid when next has no after cursor', async () => {
        mockedFetchProjectBuilds.mockReturnValue(
          mockHubSpotHttpResponse({
            results: [detailedBuild],
            paging: { next: {} },
          })
        );

        await projectListBuildsCommand.handler(args);

        expect(uiLogger.json).toHaveBeenCalledTimes(1);
        expect(uiLogger.json).toHaveBeenCalledWith(
          expect.not.objectContaining({ paging: expect.anything() })
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });
    });

    describe('error behavior', () => {
      it('should exit with an error for a not-found project', async () => {
        mockedFetchProject.mockImplementation(() => {
          throw mockHubSpotHttpError('Not Found', {
            status: HttpStatusCode.NotFound,
            data: {},
          });
        });

        await projectListBuildsCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('not found')
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should exit with an error after a caught API error', async () => {
        mockedFetchProjectBuilds.mockImplementation(() => {
          throw mockHubSpotHttpError('Server Error', {
            status: HttpStatusCode.InternalServerError,
            data: {},
          });
        });

        await projectListBuildsCommand.handler(args);

        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(processExitSpy).not.toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should exit cleanly on a prompt cancellation instead of logging an error', async () => {
        mockedFetchProjectBuilds.mockReturnValue(
          buildsResponse([build], 'CURSOR')
        );
        vi.mocked(promptUser).mockImplementation(() => {
          throw new PromptExitError('User exited', EXIT_CODES.SUCCESS);
        });

        await projectListBuildsCommand.handler(args);

        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
        expect(uiLogger.error).not.toHaveBeenCalled();
      });
    });
  });
});
