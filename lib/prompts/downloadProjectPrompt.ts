import { promptUser } from './promptUtils.js';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { logger } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { i18n } from '../lang.js';
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
    logger.error(
      i18n(`lib.prompts.downloadProjectPrompt.errors.accountIdRequired`)
    );
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
          ? i18n(`lib.prompts.downloadProjectPrompt.errors.projectNotFound`, {
              projectName: promptOptions.project,
              accountId: accountId || '',
            })
          : i18n(`lib.prompts.downloadProjectPrompt.selectProject`);
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
