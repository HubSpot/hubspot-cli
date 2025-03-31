import { promptUser } from './promptUtils';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../errorHandlers/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../enums/exitCodes';
import { i18n } from '../lang';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import {
  getConfigAccountIfExists,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';

const i18nKey = 'lib.prompts.downloadProjectPrompt';

type DownloadProjectPromptResponse = {
  project: string;
};

async function createProjectsList(
  accountId: number | undefined
): Promise<Project[]> {
  try {
    if (accountId) {
      const { data: projects } = await fetchProjects(accountId);
      return projects.results;
    }
    logger.error(i18n(`${i18nKey}.errors.accountIdRequired`));
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
  const account =
    (promptOptions.account &&
      getConfigAccountIfExists(promptOptions.account)) ||
    getConfigDefaultAccount();
  const projectsList = await createProjectsList(account.accountId);

  return promptUser<DownloadProjectPromptResponse>([
    {
      name: 'project',
      message: () => {
        return promptOptions.project &&
          !projectsList.find(p => p.name === promptOptions.name)
          ? i18n(`${i18nKey}.errors.projectNotFound`, {
              projectName: promptOptions.project,
              accountId: account.accountId,
            })
          : i18n(`${i18nKey}.selectProject`);
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
}
