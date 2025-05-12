import { promptUser } from './promptUtils';

const { i18n } = require('../lang');

export type GetStartedPromptResponse = {
  appName: string;
};

const DEFAULT_APP_NAME = 'my-hubspot-app';

export function appNamePrompt(): Promise<GetStartedPromptResponse> {
  return promptUser<GetStartedPromptResponse>({
    name: 'appName',
    message: i18n('lib.prompts.getStarted.appNamePrompt'),
    default: DEFAULT_APP_NAME,
  });
}
