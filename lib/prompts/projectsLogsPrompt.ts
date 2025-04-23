import { i18n } from '../lang';
import { promptUser } from './promptUtils';

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
      message: i18n('lib.prompts.projectLogsPrompt.functionName', {
        projectName,
      }),
      when: () =>
        (!promptOptions || !promptOptions.function) &&
        functionChoices.length > 0,
      choices: functionChoices,
    },
  ]);
}
