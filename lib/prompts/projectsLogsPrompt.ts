import { i18n } from '../lang';
import { promptUser } from './promptUtils';

const i18nKey = 'lib.prompts.projectLogsPrompt';

type ProjectLogsPromptOptions = {
  functionChoices?: string[];
  promptOptions?: { function?: string };
  projectName?: string;
};

type ProjectLogsPromptResponse = {
  functionName?: string;
};

export async function projectLogsPrompt({
  functionChoices,
  promptOptions,
  projectName = '',
}: ProjectLogsPromptOptions): Promise<ProjectLogsPromptResponse> {
  if (!functionChoices) {
    return {};
  }
  if (functionChoices.length === 1) {
    return { functionName: functionChoices[0] };
  }

  return promptUser<ProjectLogsPromptResponse>([
    {
      name: 'functionName',
      type: 'list',
      message: i18n(`${i18nKey}.functionName`, { projectName }),
      when: () =>
        (!promptOptions || !promptOptions.function) &&
        functionChoices.length > 0,
      choices: functionChoices,
    },
  ]);
}
