import { promptUser } from './promptUtils.js';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { lib } from '../../lang/en.js';
import { Project } from '@hubspot/local-dev-lib/types/Project';

type DownloadProjectPromptResponse = {
  project: string;
};

async function createProjectsList(
  accountId: number | null
): Promise<Project[]> {
  try {
    if (accountId) {
      const { data: projects } = await fetchProjects(accountId);
      return projects.results;
    }
    uiLogger.error(lib.prompts.downloadProjectPrompt.errors.accountIdRequired);
    process.exit(EXIT_CODES.ERROR);
  } catch (e) {
    logError(e, accountId ? new ApiErrorContext({ accountId }) : undefined);
    process.exit(EXIT_CODES.ERROR);
  }
}

export async function downloadProjectPrompt(promptOptions: {
  account?: string;
  project?: string;
  name?: string;
}): Promise<DownloadProjectPromptResponse> {
  const accountId = getAccountId(promptOptions.account);
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
