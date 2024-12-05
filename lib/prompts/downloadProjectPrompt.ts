import { promptUser } from './promptUtils';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../errorHandlers/index';
import { EXIT_CODES } from '../enums/exitCodes';
import { i18n } from '../lang';
import { Project } from '@hubspot/local-dev-lib/types/Project';

const i18nKey = 'lib.prompts.downloadProjectPrompt';

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
    return [];
  } catch (e) {
    if (accountId) {
      logError(e, new ApiErrorContext({ accountId }));
    } else {
      logError(e);
    }
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

  return promptUser<DownloadProjectPromptResponse>([
    {
      name: 'project',
      message: () => {
        return promptOptions.project &&
          !projectsList.find(p => p.name === promptOptions.name)
          ? i18n(`${i18nKey}.errors.projectNotFound`, {
              projectName: promptOptions.project,
              accountId: accountId || '',
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
