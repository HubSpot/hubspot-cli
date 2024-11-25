import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.cleanUploadPrompt';

export async function cleanUploadPrompt(
  accountId: number,
  filePath: string
): Promise<boolean> {
  const promptAnswer = await promptUser([
    {
      name: 'cleanUpload',
      message: i18n(`${i18nKey}.message`, { accountId, filePath }),
      type: 'confirm',
      default: false,
    },
  ]);
  return promptAnswer.cleanUpload;
}
