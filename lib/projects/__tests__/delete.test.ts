import * as projectApiUtils from '@hubspot/local-dev-lib/api/projects';
import * as appsDevUtils from '@hubspot/local-dev-lib/api/appsDev';
import {
  FetchProjectResponse,
  Project,
} from '@hubspot/local-dev-lib/types/Project';
import {
  Deploy,
  ProjectDeletionResponse,
} from '@hubspot/local-dev-lib/types/Deploy';
import { FetchPublicAppsForPortalResponse } from '@hubspot/local-dev-lib/types/Apps';
import * as promptUtils from '../../prompts/promptUtils.js';
import * as errorHandlers from '../../errorHandlers/index.js';
import * as pollingUtils from '../../polling.js';
import { uiLogger } from '../../ui/logger.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { mockHubSpotHttpResponse } from '../../testUtils.js';
import { commands } from '../../../lang/en.js';
import {
  DELETION_POLL_TIMEOUT_MS,
  DELETION_DEPLOY_SUCCESS_STATES,
  DELETION_DEPLOY_ERROR_STATES,
  resolveProjectName,
  checkDeployedComponents,
  deleteDeployedComponents,
  handleProjectDeletion,
  confirmDeletion,
  fetchProjectInstallCount,
} from '../delete.js';

vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../prompts/promptUtils.js');
vi.mock('../../errorHandlers/index.js');
vi.mock('../../ui/SpinniesManager.js');
vi.mock('../../polling.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../polling.js')>();
  return { ...actual, poll: vi.fn() };
});

const mockFetchProjects = vi.mocked(projectApiUtils.fetchProjects);
const mockFetchProject = vi.mocked(projectApiUtils.fetchProject);
const mockDeleteProject = vi.mocked(projectApiUtils.deleteProject);
const mockStageProjectForDeletion = vi.mocked(
  projectApiUtils.stageProjectForDeletion
);
const mockFetchPublicAppsForPortal = vi.mocked(
  appsDevUtils.fetchPublicAppsForPortal
);
const mockPoll = vi.mocked(pollingUtils.poll);
const mockListPrompt = vi.mocked(promptUtils.listPrompt);
const mockConfirmPrompt = vi.mocked(promptUtils.confirmPrompt);
const mockDebugError = vi.mocked(errorHandlers.debugError);
const mockGetErrorMessage = vi.mocked(errorHandlers.getErrorMessage);
const mockSpinniesAdd = vi.mocked(SpinniesManager.add);
const mockSpinniesSucceed = vi.mocked(SpinniesManager.succeed);
const mockSpinniesFail = vi.mocked(SpinniesManager.fail);

const ACCOUNT_ID = 123456;
const PROJECT_ID = 99;
const PROJECT_NAME = 'my-project';
const V2_PLATFORM_VERSION = '2025.2';
const LEGACY_PLATFORM_VERSION = '2024.1';

const exampleProjects = {
  results: [{ name: PROJECT_NAME, id: 1, portalId: ACCOUNT_ID }],
};

describe('lib/projects/delete', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('resolveProjectName()', () => {
    describe('when projectArg is provided', () => {
      beforeEach(() => {
        mockFetchProjects.mockReturnValue(
          mockHubSpotHttpResponse<FetchProjectResponse>(exampleProjects)
        );
      });

      it('returns the project name when it exists', async () => {
        const result = await resolveProjectName(ACCOUNT_ID, PROJECT_NAME);
        expect(result).toBe(PROJECT_NAME);
      });

      it('throws with the project not found message when project is missing', async () => {
        await expect(
          resolveProjectName(ACCOUNT_ID, 'non-existent')
        ).rejects.toThrow(
          commands.project.delete.errors.projectNotFound(
            'non-existent',
            ACCOUNT_ID
          )
        );
      });
    });

    describe('when projectArg is undefined', () => {
      it('shows a list prompt and returns the selected project', async () => {
        mockFetchProjects.mockReturnValue(
          mockHubSpotHttpResponse<FetchProjectResponse>(exampleProjects)
        );
        mockListPrompt.mockResolvedValue(PROJECT_NAME);

        const result = await resolveProjectName(ACCOUNT_ID, undefined);

        expect(result).toBe(PROJECT_NAME);
        expect(mockListPrompt).toHaveBeenCalledWith(
          commands.project.delete.prompts.selectProject(ACCOUNT_ID),
          expect.objectContaining({
            choices: [{ name: PROJECT_NAME, value: PROJECT_NAME }],
          })
        );
      });

      it('throws with the no projects found message when the account has no projects', async () => {
        mockFetchProjects.mockReturnValue(
          mockHubSpotHttpResponse<FetchProjectResponse>({ results: [] })
        );

        await expect(resolveProjectName(ACCOUNT_ID, undefined)).rejects.toThrow(
          commands.project.delete.errors.noProjectsFound(ACCOUNT_ID)
        );
      });

      it('throws the validation message when the list prompt returns no selection', async () => {
        mockFetchProjects.mockReturnValue(
          mockHubSpotHttpResponse<FetchProjectResponse>(exampleProjects)
        );
        mockListPrompt.mockResolvedValue(undefined as unknown as string);

        await expect(resolveProjectName(ACCOUNT_ID, undefined)).rejects.toThrow(
          commands.project.delete.prompts.validation.projectRequired
        );
      });
    });

    it('rethrows when fetchProjects fails', async () => {
      mockFetchProjects.mockRejectedValue(new Error('Network error'));

      await expect(
        resolveProjectName(ACCOUNT_ID, PROJECT_NAME)
      ).rejects.toThrow('Network error');
    });
  });

  describe('checkDeployedComponents()', () => {
    describe('v2 project', () => {
      beforeEach(() => {
        mockFetchProject.mockReturnValue(
          mockHubSpotHttpResponse<Project>({
            id: PROJECT_ID,
            name: PROJECT_NAME,
            deployedBuild: { platformVersion: V2_PLATFORM_VERSION },
          } as unknown as Project)
        );
      });

      it('calls stageProjectForDeletion with dryRun=true', async () => {
        mockStageProjectForDeletion.mockReturnValue(
          mockHubSpotHttpResponse<ProjectDeletionResponse>({
            hasDeployedComponents: false,
            componentsToRemove: [],
          })
        );

        await checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME);

        expect(mockStageProjectForDeletion).toHaveBeenCalledWith(
          ACCOUNT_ID,
          PROJECT_NAME,
          true
        );
      });

      it('returns the project id', async () => {
        mockStageProjectForDeletion.mockReturnValue(
          mockHubSpotHttpResponse<ProjectDeletionResponse>({
            hasDeployedComponents: false,
            componentsToRemove: [],
          })
        );

        const result = await checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME);

        expect(result.projectId).toBe(PROJECT_ID);
      });

      it('returns hasUnifiedComponents=true and logs components when deployed components exist', async () => {
        const components = [{ componentType: 'APP', componentId: 'my-app' }];
        mockStageProjectForDeletion.mockReturnValue(
          mockHubSpotHttpResponse<ProjectDeletionResponse>({
            hasDeployedComponents: true,
            componentsToRemove: components,
          })
        );

        const result = await checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME);

        expect(result.hasUnifiedComponents).toBe(true);
        expect(uiLogger.log).toHaveBeenCalledWith(
          commands.project.delete.logs.componentsToDeleteUnified(components)
        );
      });

      it('returns hasUnifiedComponents=false and does not log when no deployed components exist', async () => {
        mockStageProjectForDeletion.mockReturnValue(
          mockHubSpotHttpResponse<ProjectDeletionResponse>({
            hasDeployedComponents: false,
            componentsToRemove: [],
          })
        );

        const result = await checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME);

        expect(result.hasUnifiedComponents).toBe(false);
        expect(uiLogger.log).not.toHaveBeenCalled();
      });

      it('calls debugError and throws a formatted error when staging fails', async () => {
        const stagingError = new Error('Marketplace listing blocker');
        mockStageProjectForDeletion.mockRejectedValue(stagingError);
        mockGetErrorMessage.mockReturnValue('Marketplace listing blocker');

        await expect(
          checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME)
        ).rejects.toThrow(
          commands.project.delete.errors.cannotDelete(
            PROJECT_NAME,
            'Marketplace listing blocker'
          )
        );
        expect(mockDebugError).toHaveBeenCalledWith(stagingError);
      });
    });

    describe('legacy project', () => {
      it('returns hasUnifiedComponents=false and logs user-visible components', async () => {
        mockFetchProject.mockReturnValue(
          mockHubSpotHttpResponse<Project>({
            id: PROJECT_ID,
            name: PROJECT_NAME,
            deployedBuild: {
              platformVersion: LEGACY_PLATFORM_VERSION,
              subbuildStatuses: [
                { buildType: 'THEME', buildName: 'my-theme' },
                { buildType: 'PRIVATE_APP', buildName: 'my-private-app' },
                { buildType: 'SERVERLESS_PKG', buildName: 'my-pkg' },
              ],
            },
          } as unknown as Project)
        );

        const result = await checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME);

        expect(result.hasUnifiedComponents).toBe(false);
        expect(mockStageProjectForDeletion).not.toHaveBeenCalled();
        expect(uiLogger.log).toHaveBeenCalledWith(
          commands.project.delete.logs.componentsToDeleteLegacy([
            'my-theme - (Theme)',
          ])
        );
      });

      it('does not log when all components are filtered out', async () => {
        mockFetchProject.mockReturnValue(
          mockHubSpotHttpResponse<Project>({
            id: PROJECT_ID,
            name: PROJECT_NAME,
            deployedBuild: {
              platformVersion: LEGACY_PLATFORM_VERSION,
              subbuildStatuses: [
                { buildType: 'PRIVATE_APP', buildName: 'my-private-app' },
                { buildType: 'SERVERLESS_PKG', buildName: 'my-pkg' },
              ],
            },
          } as unknown as Project)
        );

        const result = await checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME);

        expect(result.hasUnifiedComponents).toBe(false);
        expect(uiLogger.log).not.toHaveBeenCalled();
      });
    });

    it('throws when platform version cannot be determined', async () => {
      mockFetchProject.mockReturnValue(
        mockHubSpotHttpResponse<Project>({
          id: PROJECT_ID,
          name: PROJECT_NAME,
        } as unknown as Project)
      );

      await expect(
        checkDeployedComponents(ACCOUNT_ID, PROJECT_NAME)
      ).rejects.toThrow(commands.project.delete.errors.noPlatformVersion);
    });
  });

  describe('deleteDeployedComponents()', () => {
    const deployId = 42;

    beforeEach(() => {
      mockStageProjectForDeletion.mockReturnValue(
        mockHubSpotHttpResponse<ProjectDeletionResponse>({
          hasDeployedComponents: true,
          componentsToRemove: [],
          deployId,
        })
      );
      mockPoll.mockResolvedValue({
        status: 'SUCCESS',
        deployId,
        subdeployStatuses: [],
      } as unknown as Deploy);
    });

    it('adds a spinner with the removing components message', async () => {
      await deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME);
      expect(mockSpinniesAdd).toHaveBeenCalledWith('removeComponents', {
        text: commands.project.delete.logs.deletingComponents(PROJECT_NAME),
      });
    });

    it('calls stageProjectForDeletion with dryRun=false', async () => {
      await deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME);
      expect(mockStageProjectForDeletion).toHaveBeenCalledWith(
        ACCOUNT_ID,
        PROJECT_NAME,
        false
      );
    });

    it('polls deploy status with the correct states and timeout', async () => {
      await deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME);
      expect(mockPoll).toHaveBeenCalledWith(
        expect.any(Function),
        {
          successStates: DELETION_DEPLOY_SUCCESS_STATES,
          errorStates: DELETION_DEPLOY_ERROR_STATES,
        },
        DELETION_POLL_TIMEOUT_MS
      );
    });

    it('succeeds the spinner after polling completes', async () => {
      await deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME);
      expect(mockSpinniesSucceed).toHaveBeenCalledWith('removeComponents', {
        text: commands.project.delete.logs.componentsDeleted(PROJECT_NAME),
      });
    });

    it('skips polling and succeeds the spinner when there are no deployed components', async () => {
      mockStageProjectForDeletion.mockReturnValue(
        mockHubSpotHttpResponse<ProjectDeletionResponse>({
          hasDeployedComponents: false,
          componentsToRemove: [],
        })
      );

      await deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME);
      expect(mockPoll).not.toHaveBeenCalled();
      expect(mockSpinniesSucceed).toHaveBeenCalledWith('removeComponents', {
        text: commands.project.delete.logs.componentsDeleted(PROJECT_NAME),
      });
    });

    it('fails the spinner and throws when deployId is missing but components exist', async () => {
      mockStageProjectForDeletion.mockReturnValue(
        mockHubSpotHttpResponse<ProjectDeletionResponse>({
          hasDeployedComponents: true,
          componentsToRemove: [],
        })
      );

      await expect(
        deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME)
      ).rejects.toThrow(
        commands.project.delete.logs.unableToDetermineIfComponentsWereDeleted(
          PROJECT_NAME
        )
      );
      expect(mockPoll).not.toHaveBeenCalled();
      expect(mockSpinniesFail).toHaveBeenCalledWith('removeComponents', {
        text: commands.project.delete.logs.unableToDetermineIfComponentsWereDeleted(
          PROJECT_NAME
        ),
      });
    });

    it('fails the spinner and throws a formatted error when staging fails', async () => {
      const stagingError = new Error('Staging failed');
      mockStageProjectForDeletion.mockRejectedValue(stagingError);

      await expect(
        deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME)
      ).rejects.toThrow(
        commands.project.delete.errors.componentDeletionFailed(PROJECT_NAME)
      );
      expect(mockDebugError).toHaveBeenCalledWith(stagingError);
      expect(mockSpinniesFail).toHaveBeenCalledWith('removeComponents', {
        text: commands.project.delete.errors.componentDeletionFailed(
          PROJECT_NAME
        ),
      });
    });

    it('fails the spinner and throws a formatted error when polling fails', async () => {
      const pollError = new Error('Poll timed out');
      mockPoll.mockRejectedValue(pollError);

      await expect(
        deleteDeployedComponents(ACCOUNT_ID, PROJECT_NAME)
      ).rejects.toThrow(
        commands.project.delete.errors.componentDeletionFailed(PROJECT_NAME)
      );
      expect(mockDebugError).toHaveBeenCalledWith(pollError);
      expect(mockSpinniesFail).toHaveBeenCalledWith('removeComponents', {
        text: commands.project.delete.errors.componentDeletionFailed(
          PROJECT_NAME
        ),
      });
    });
  });

  describe('fetchProjectInstallCount()', () => {
    it('returns the sum of install counts for apps in the project', async () => {
      mockFetchPublicAppsForPortal.mockReturnValue(
        mockHubSpotHttpResponse<FetchPublicAppsForPortalResponse>({
          results: [
            {
              projectId: PROJECT_ID,
              publicApplicationInstallCounts: { uniquePortalInstallCount: 3 },
            },
            {
              projectId: PROJECT_ID,
              publicApplicationInstallCounts: { uniquePortalInstallCount: 7 },
            },
            {
              projectId: 999,
              publicApplicationInstallCounts: { uniquePortalInstallCount: 100 },
            },
          ],
        } as unknown as FetchPublicAppsForPortalResponse)
      );

      const result = await fetchProjectInstallCount(ACCOUNT_ID, PROJECT_ID);

      expect(result).toBe(10);
    });

    it('returns 0 when no apps belong to the project', async () => {
      mockFetchPublicAppsForPortal.mockReturnValue(
        mockHubSpotHttpResponse<FetchPublicAppsForPortalResponse>({
          results: [
            {
              projectId: 999,
              publicApplicationInstallCounts: { uniquePortalInstallCount: 5 },
            },
          ],
        } as unknown as FetchPublicAppsForPortalResponse)
      );

      const result = await fetchProjectInstallCount(ACCOUNT_ID, PROJECT_ID);

      expect(result).toBe(0);
    });

    it('returns 0, calls debugError, and logs a warning when the API call fails', async () => {
      const apiError = new Error('Network error');
      mockFetchPublicAppsForPortal.mockRejectedValue(apiError);

      const result = await fetchProjectInstallCount(ACCOUNT_ID, PROJECT_ID);

      expect(result).toBe(0);
      expect(mockDebugError).toHaveBeenCalledWith(apiError);
      expect(uiLogger.warn).toHaveBeenCalledWith(
        commands.project.delete.logs.installCountUnknown
      );
    });
  });

  describe('deleteProjectWithSpinner()', () => {
    it('adds a spinner, calls deleteProject, and succeeds the spinner', async () => {
      mockDeleteProject.mockReturnValue(mockHubSpotHttpResponse<void>());

      await handleProjectDeletion(ACCOUNT_ID, PROJECT_NAME);

      expect(mockSpinniesAdd).toHaveBeenCalledWith('deleteProject', {
        text: commands.project.delete.logs.deleting(PROJECT_NAME),
      });
      expect(mockDeleteProject).toHaveBeenCalledWith(ACCOUNT_ID, PROJECT_NAME);
      expect(mockSpinniesSucceed).toHaveBeenCalledWith('deleteProject', {
        text: commands.project.delete.logs.deleted(PROJECT_NAME, ACCOUNT_ID),
      });
    });

    it('fails the spinner and rethrows when deleteProject fails', async () => {
      const deleteError = new Error('API error');
      mockDeleteProject.mockRejectedValue(deleteError);

      await expect(
        handleProjectDeletion(ACCOUNT_ID, PROJECT_NAME)
      ).rejects.toThrow('API error');
      expect(mockSpinniesFail).toHaveBeenCalledWith('deleteProject', {
        text: commands.project.delete.errors.deleteFailed(PROJECT_NAME),
      });
    });
  });

  describe('confirmDeletion()', () => {
    beforeEach(() => {
      mockFetchPublicAppsForPortal.mockReturnValue(
        mockHubSpotHttpResponse<FetchPublicAppsForPortalResponse>({
          results: [],
        } as unknown as FetchPublicAppsForPortalResponse)
      );
    });

    it('shows the confirm prompt with project and account details', async () => {
      mockConfirmPrompt.mockResolvedValue(true);

      await confirmDeletion(PROJECT_NAME, ACCOUNT_ID, PROJECT_ID);

      expect(mockConfirmPrompt).toHaveBeenCalledWith(
        commands.project.delete.prompts.confirmDelete(PROJECT_NAME, ACCOUNT_ID),
        { defaultAnswer: false }
      );
    });

    it('resolves when the user confirms', async () => {
      mockConfirmPrompt.mockResolvedValue(true);
      await expect(
        confirmDeletion(PROJECT_NAME, ACCOUNT_ID, PROJECT_ID)
      ).resolves.toBeUndefined();
    });

    it('throws a PromptExitError with the success exit code when the user declines', async () => {
      mockConfirmPrompt.mockResolvedValue(false);
      await expect(
        confirmDeletion(PROJECT_NAME, ACCOUNT_ID, PROJECT_ID)
      ).rejects.toMatchObject({
        exitCode: EXIT_CODES.SUCCESS,
      });
    });

    it('logs the cancelled message and throws a PromptExitError when the user declines', async () => {
      mockConfirmPrompt.mockResolvedValue(false);

      await expect(
        confirmDeletion(PROJECT_NAME, ACCOUNT_ID, PROJECT_ID)
      ).rejects.toBeInstanceOf(PromptExitError);
      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.project.delete.logs.cancelled
      );
    });

    it('does not log an install warning when the project has no installations', async () => {
      mockConfirmPrompt.mockResolvedValue(true);

      await confirmDeletion(PROJECT_NAME, ACCOUNT_ID, PROJECT_ID);

      expect(uiLogger.warn).not.toHaveBeenCalled();
    });

    it('logs an install warning before the prompt when the project has active installations', async () => {
      mockConfirmPrompt.mockResolvedValue(true);
      mockFetchPublicAppsForPortal.mockReturnValue(
        mockHubSpotHttpResponse<FetchPublicAppsForPortalResponse>({
          results: [
            {
              projectId: PROJECT_ID,
              publicApplicationInstallCounts: { uniquePortalInstallCount: 5 },
            },
          ],
        } as unknown as FetchPublicAppsForPortalResponse)
      );

      await confirmDeletion(PROJECT_NAME, ACCOUNT_ID, PROJECT_ID);

      expect(uiLogger.warn).toHaveBeenCalledWith(
        commands.project.delete.logs.installWarning(5)
      );
    });
  });
});
