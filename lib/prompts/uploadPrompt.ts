import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils.js';
import { i18n } from '../lang.js';

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
      message: i18n(`lib.prompts.uploadPrompt.enterSrc`),
      when: !promptOptions.src,
      default: '.',
      validate: (input?: string) => {
        if (!input) {
          return i18n(`lib.prompts.uploadPrompt.errors.srcRequired`);
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: i18n(`lib.prompts.uploadPrompt.enterDest`),
      when: !promptOptions.dest,
      default: path.basename(getCwd()),
      validate: (input?: string) => {
        if (!input) {
          return i18n(`lib.prompts.uploadPrompt.errors.destRequired`);
        }
        return true;
      },
    },
  ]);
}
