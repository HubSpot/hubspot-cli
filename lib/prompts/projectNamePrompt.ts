import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { ensureProjectExists } from '../projects/ensureProjectExists';
import { uiAccountDescription } from '../ui';

export type ProjectNamePromptResponse = {
  projectName: string;
};

export async function projectNamePrompt(
  accountId: number,
  options: { project?: string } = {}
) {
  const result = await promptUser<ProjectNamePromptResponse>({
    name: 'projectName',
    message: i18n(`lib.prompts.projectNamePrompt.enterName`),
    when: !options.project,
    validate: async val => {
      if (typeof val !== 'string' || !val) {
        return i18n(`lib.prompts.projectNamePrompt.errors.invalidName`);
      }
      const { projectExists } = await ensureProjectExists(accountId, val, {
        allowCreate: false,
        noLogs: true,
      });
      if (!projectExists) {
        return i18n(
          `lib.prompts.projectNamePrompt.errors.projectDoesNotExist`,
          {
            projectName: val,
            accountIdentifier: uiAccountDescription(accountId),
          }
        );
      }
      return true;
    },
  });

  if (!result.projectName && options.project) {
    result.projectName = options.project;
  }

  return result;
}
