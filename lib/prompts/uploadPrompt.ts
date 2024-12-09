import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.uploadPrompt';

type UploadPromptResponse = {
  src: string;
  dest: string;
};

export async function uploadPrompt(
  promptOptions: { src?: string; dest?: string } = {}
): Promise<UploadPromptResponse> {
  return promptUser<UploadPromptResponse>([
    {
      name: 'src',
      message: i18n(`${i18nKey}.enterSrc`),
      when: !promptOptions.src,
      default: '.',
      validate: (input?: string) => {
        if (!input) {
          return i18n(`${i18nKey}.errors.srcRequired`);
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: i18n(`${i18nKey}.enterDest`),
      when: !promptOptions.dest,
      default: path.basename(getCwd()),
      validate: (input?: string) => {
        if (!input) {
          return i18n(`${i18nKey}.errors.destRequired`);
        }
        return true;
      },
    },
  ]);
}
