import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
} from '../../../lib/commonOpts.js';
import * as projectApiUtils from '@hubspot/local-dev-lib/api/projects';
import * as appsDevUtils from '@hubspot/local-dev-lib/api/appsDev';
import { FetchProjectResponse } from '@hubspot/local-dev-lib/types/Project';
import { FetchPublicAppsForPortalResponse } from '@hubspot/local-dev-lib/types/Apps';
import {
  Deploy,
  ProjectDeletionResponse,
} from '@hubspot/local-dev-lib/types/Deploy';
import * as platformVersionUtils from '../../../lib/projects/platformVersion.js';
import * as promptUtils from '../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { mockHubSpotHttpResponse } from '../../../lib/testUtils.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import { commands } from '../../../lang/en.js';
import projectDeleteCommand, { ProjectDeleteArgs } from '../delete.js';

vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/projects/platformVersion');
vi.mock('../../../lib/prompts/promptUtils');
vi.mock('../../../lib/ui/SpinniesManager.js');
vi.mock('../../../ui/render.js');
vi.mock('../../../ui/components/StatusMessageBoxes.js');
vi.mock('../../../lib/constants.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../../lib/constants.js')>();
  return { ...actual, DEFAULT_POLLING_DELAY: 0 };
});

const fetchProjectsSpy = vi.spyOn(projectApiUtils, 'fetchProjects');
const fetchProjectSpy = vi.spyOn(projectApiUtils, 'fetchProject');
const deleteProjectSpy = vi.spyOn(projectApiUtils, 'deleteProject');
const stageProjectForDeletionSpy = vi.spyOn(
  projectApiUtils,
  'stageProjectForDeletion'
);
const getDeployStatusSpy = vi.spyOn(projectApiUtils, 'getDeployStatus');
const isV2ProjectSpy = vi.spyOn(platformVersionUtils, 'isV2Project');
const confirmPromptSpy = vi.spyOn(promptUtils, 'confirmPrompt');
const fetchPublicAppsForPortalSpy = vi.spyOn(
  appsDevUtils,
  'fetchPublicAppsForPortal'
);
// @ts-expect-error process.exit mock does not match the real signature
const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

const ACCOUNT_ID = 123456;
const PROJECT_NAME = 'my-project';

const exampleProjects = {
  results: [{ name: PROJECT_NAME, id: 1, portalId: ACCOUNT_ID }],
};

const PROJECT_ID = 99;

const exampleProjectV2 = {
  id: PROJECT_ID,
  name: PROJECT_NAME,
  deployedBuild: { platformVersion: '2025.2' },
};

const exampleProjectOld = {
  id: PROJECT_ID,
  name: PROJECT_NAME,
  deployedBuild: { platformVersion: '2024.1' },
};

const exampleComponents = [
  { componentType: 'APP', componentId: 'my-app' },
  { componentType: 'SERVERLESS_FUNCTION', componentId: 'my-function' },
];

describe('commands/project/delete', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectDeleteCommand.command).toEqual('delete');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectDeleteCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectDeleteCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectDeleteCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalled();
    });

    it('should define project option', () => {
      const optionSpy = vi.spyOn(yargsMock, 'option');

      projectDeleteCommand.builder(yargsMock);

      expect(optionSpy).toHaveBeenCalledWith(
        'project-name',
        expect.any(Object)
      );
    });

    it('should define force option', () => {
      const optionSpy = vi.spyOn(yargsMock, 'option');

      projectDeleteCommand.builder(yargsMock);

      expect(optionSpy).toHaveBeenCalledWith('force', expect.any(Object));
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<ProjectDeleteArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: ACCOUNT_ID,
        projectName: PROJECT_NAME,
        force: true,
      } as ArgumentsCamelCase<ProjectDeleteArgs>;

      fetchProjectsSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchProjectResponse>(exampleProjects)
      );
      deleteProjectSpy.mockReturnValue(mockHubSpotHttpResponse<void>());
      confirmPromptSpy.mockResolvedValue(true);
      fetchPublicAppsForPortalSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchPublicAppsForPortalResponse>({
          results: [],
        } as unknown as FetchPublicAppsForPortalResponse)
      );
    });

    describe('old platform version projects', () => {
      beforeEach(() => {
        fetchProjectSpy.mockReturnValue(
          mockHubSpotHttpResponse(exampleProjectOld)
        );
        isV2ProjectSpy.mockReturnValue(false);
      });

      it('should call deleteProject directly without staging', async () => {
        await projectDeleteCommand.handler(args);

        expect(stageProjectForDeletionSpy).not.toHaveBeenCalled();
        expect(deleteProjectSpy).toHaveBeenCalledWith(ACCOUNT_ID, PROJECT_NAME);
      });

      it('should succeed the spinner after deletion', async () => {
        await projectDeleteCommand.handler(args);

        expect(SpinniesManager.succeed).toHaveBeenCalledWith('deleteProject', {
          text: commands.project.delete.logs.deleted(PROJECT_NAME, ACCOUNT_ID),
        });
      });
    });

    describe('v2 projects with deployed components', () => {
      const dryRunResponse = {
        hasDeployedComponents: true,
        componentsToRemove: exampleComponents,
      };
      const stageResponse = {
        hasDeployedComponents: true,
        componentsToRemove: exampleComponents,
        deployId: 42,
      };
      const successDeploy = {
        status: 'SUCCESS',
        deployId: 42,
        subdeployStatuses: [],
      };

      beforeEach(() => {
        fetchProjectSpy.mockReturnValue(
          mockHubSpotHttpResponse(exampleProjectV2)
        );
        isV2ProjectSpy.mockReturnValue(true);
        stageProjectForDeletionSpy
          .mockReturnValueOnce(
            mockHubSpotHttpResponse<ProjectDeletionResponse>(dryRunResponse)
          )
          .mockReturnValueOnce(
            mockHubSpotHttpResponse<ProjectDeletionResponse>(stageResponse)
          );
        getDeployStatusSpy.mockReturnValue(
          mockHubSpotHttpResponse<Deploy>(successDeploy)
        );
      });

      it('should call stageProjectForDeletion with dryRun=true first', async () => {
        await projectDeleteCommand.handler(args);

        expect(stageProjectForDeletionSpy).toHaveBeenNthCalledWith(
          1,
          ACCOUNT_ID,
          PROJECT_NAME,
          true
        );
      });

      it('should log the components that will be deleted', async () => {
        const logSpy = vi.spyOn(uiLogger, 'log');

        await projectDeleteCommand.handler(args);

        expect(logSpy).toHaveBeenCalledWith(
          commands.project.delete.logs.componentsToDeleteUnified(
            exampleComponents
          )
        );
      });

      it('should call stageProjectForDeletion with dryRun=false after confirmation', async () => {
        await projectDeleteCommand.handler(args);

        expect(stageProjectForDeletionSpy).toHaveBeenNthCalledWith(
          2,
          ACCOUNT_ID,
          PROJECT_NAME,
          false
        );
      });

      it('should poll the deploy status', async () => {
        await projectDeleteCommand.handler(args);

        expect(getDeployStatusSpy).toHaveBeenCalledWith(
          ACCOUNT_ID,
          PROJECT_NAME,
          42
        );
      });

      it('should call deleteProject after components are removed', async () => {
        await projectDeleteCommand.handler(args);

        expect(deleteProjectSpy).toHaveBeenCalledWith(ACCOUNT_ID, PROJECT_NAME);
      });

      it('should exit with error if component removal deploy fails', async () => {
        const errorSpy = vi.spyOn(uiLogger, 'error');
        getDeployStatusSpy.mockReturnValue(
          mockHubSpotHttpResponse<Deploy>({
            status: 'FAILURE',
            deployId: 42,
            subdeployStatuses: [],
          })
        );

        await projectDeleteCommand.handler(args);

        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(errorSpy).toHaveBeenCalledWith(
          commands.project.delete.errors.componentDeletionFailed(PROJECT_NAME)
        );
      });
    });

    describe('v2 projects with no deployed components', () => {
      const dryRunResponse = {
        hasDeployedComponents: false,
        componentsToRemove: [],
      };

      beforeEach(() => {
        fetchProjectSpy.mockReturnValue(
          mockHubSpotHttpResponse(exampleProjectV2)
        );
        isV2ProjectSpy.mockReturnValue(true);
        stageProjectForDeletionSpy.mockReturnValue(
          mockHubSpotHttpResponse<ProjectDeletionResponse>(dryRunResponse)
        );
      });

      it('should skip staging and poll when no components exist', async () => {
        await projectDeleteCommand.handler(args);

        expect(stageProjectForDeletionSpy).toHaveBeenCalledTimes(1);
        expect(getDeployStatusSpy).not.toHaveBeenCalled();
        expect(deleteProjectSpy).toHaveBeenCalledWith(ACCOUNT_ID, PROJECT_NAME);
      });
    });

    describe('v2 projects with blockers', () => {
      beforeEach(() => {
        fetchProjectSpy.mockReturnValue(
          mockHubSpotHttpResponse(exampleProjectV2)
        );
        isV2ProjectSpy.mockReturnValue(true);
        stageProjectForDeletionSpy.mockRejectedValue(
          new Error('Deploy blocked: app has marketplace listing')
        );
      });

      it('should log an error and exit when dry run returns a blocker', async () => {
        const errorSpy = vi.spyOn(uiLogger, 'error');

        await projectDeleteCommand.handler(args);

        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(errorSpy).toHaveBeenCalledWith(
          commands.project.delete.errors.cannotDelete(
            PROJECT_NAME,
            'Deploy blocked: app has marketplace listing'
          )
        );
      });
    });

    describe('confirmation prompt', () => {
      beforeEach(() => {
        fetchProjectSpy.mockReturnValue(
          mockHubSpotHttpResponse(exampleProjectOld)
        );
        isV2ProjectSpy.mockReturnValue(false);
        args.force = false;
      });

      it('should show confirmation prompt when --force is not set', async () => {
        await projectDeleteCommand.handler(args);

        expect(confirmPromptSpy).toHaveBeenCalledWith(
          commands.project.delete.prompts.confirmDelete(
            PROJECT_NAME,
            ACCOUNT_ID
          ),
          { defaultAnswer: false }
        );
      });

      it('should exit when confirmation is declined', async () => {
        confirmPromptSpy.mockResolvedValue(false);

        await projectDeleteCommand.handler(args);

        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should log an install warning when the project has active installations', async () => {
        const warnSpy = vi.spyOn(uiLogger, 'warn');
        fetchPublicAppsForPortalSpy.mockReturnValue(
          mockHubSpotHttpResponse<FetchPublicAppsForPortalResponse>({
            results: [
              {
                projectId: PROJECT_ID,
                publicApplicationInstallCounts: {
                  uniquePortalInstallCount: 4,
                },
              },
            ],
          } as unknown as FetchPublicAppsForPortalResponse)
        );

        await projectDeleteCommand.handler(args);

        expect(warnSpy).toHaveBeenCalledWith(
          commands.project.delete.logs.installWarning(4)
        );
      });

      it('should not log an install warning when the project has no installations', async () => {
        const warnSpy = vi.spyOn(uiLogger, 'warn');

        await projectDeleteCommand.handler(args);

        expect(warnSpy).not.toHaveBeenCalled();
      });
    });
  });
});
