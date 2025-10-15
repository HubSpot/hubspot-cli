import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { ensureProjectExists } from '../projects/ensureProjectExists.js';

export type ProjectNamePromptResponse = {
  projectName: string;
};

export async function projectNamePrompt(
  accountId: number,
  options: { project?: string } = {}
) {
  const result = await promptUser<ProjectNamePromptResponse>({
    name: 'projectName',
    message: lib.prompts.projectNamePrompt.enterName,
    when: !options.project,
    validate: async (val: string) => {
      if (typeof val !== 'string' || !val) {
        return lib.prompts.projectNamePrompt.errors.invalidName;
      }
      const { projectExists } = await ensureProjectExists(accountId, val, {
        allowCreate: false,
        noLogs: true,
      });
      if (!projectExists) {
        return lib.prompts.projectNamePrompt.errors.projectDoesNotExist(
          val,
          accountId
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
