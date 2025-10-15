import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';

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
      message: lib.prompts.uploadPrompt.enterSrc,
      when: !promptOptions.src,
      default: '.',
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.uploadPrompt.errors.srcRequired;
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: lib.prompts.uploadPrompt.enterDest,
      when: !promptOptions.dest,
      default: path.basename(getCwd()),
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.uploadPrompt.errors.destRequired;
        }
        return true;
      },
    },
  ]);
}
