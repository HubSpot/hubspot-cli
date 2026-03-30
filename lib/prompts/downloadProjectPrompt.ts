import { promptUser } from './promptUtils.js';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { lib } from '../../lang/en.js';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { PromptExitError } from '../errors/PromptExitError.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { uiLogger } from '../ui/logger.js';

type DownloadProjectPromptResponse = {
  project: string;
};

async function createProjectsList(
  accountId: number | null
): Promise<Project[]> {
  if (!accountId) {
    uiLogger.error(lib.prompts.downloadProjectPrompt.errors.accountIdRequired);
    throw new PromptExitError(
      lib.prompts.downloadProjectPrompt.errors.accountIdRequired,
      EXIT_CODES.ERROR
    );
  }
  try {
    const { data: projects } = await fetchProjects(accountId);
    return projects.results;
  } catch (e) {
    logError(e, new ApiErrorContext({ accountId }));
    throw new PromptExitError('Failed to fetch projects', EXIT_CODES.ERROR);
  }
}

export async function downloadProjectPrompt(promptOptions: {
  account?: string;
  derivedAccountId?: number;
  project?: string;
  name?: string;
}): Promise<DownloadProjectPromptResponse> {
  const account = promptOptions.account
    ? getConfigAccountIfExists(promptOptions.account)
    : undefined;
  const accountId =
    account?.accountId || promptOptions.derivedAccountId || null;
  const projectsList = await createProjectsList(accountId);

  const response = await promptUser<DownloadProjectPromptResponse>([
    {
      name: 'project',
      message: () => {
        return promptOptions.project &&
          !projectsList.find(p => p.name === promptOptions.name)
          ? lib.prompts.downloadProjectPrompt.errors.projectNotFound(
              promptOptions.project,
              accountId || 0
            )
          : lib.prompts.downloadProjectPrompt.selectProject;
      },
      when:
        !promptOptions.project ||
        !projectsList.find(p => p.name === promptOptions.project),
      type: 'list',
      choices: projectsList.map(project => {
        return {
          name: project.name,
          value: project.name,
        };
      }),
    },
  ]);

  if (!response.project) {
    response.project = promptOptions.project!;
  }

  return response;
}
