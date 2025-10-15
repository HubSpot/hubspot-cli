import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';

type PreviewPromptResponse = {
  src: string;
  dest: string;
};

type PreviewProjectPromptResponse = {
  themeComponentPath: string;
};

export async function previewPrompt(
  promptOptions: { src?: string; dest?: string } = {}
): Promise<PreviewPromptResponse> {
  return promptUser<PreviewPromptResponse>([
    {
      name: 'src',
      message: lib.prompts.previewPrompt.enterSrc,
      when: !promptOptions.src,
      default: '.',
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.previewPrompt.errors.srcRequired;
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: lib.prompts.previewPrompt.enterDest,
      when: !promptOptions.dest,
      default: path.basename(getCwd()),
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.previewPrompt.errors.destRequired;
        }
        return true;
      },
    },
  ]);
}

export async function previewProjectPrompt(
  themeComponents: { path: string }[]
): Promise<PreviewProjectPromptResponse> {
  return promptUser<PreviewProjectPromptResponse>([
    {
      name: 'themeComponentPath',
      message: lib.prompts.previewPrompt.themeProjectSelect,
      type: 'list',
      choices: themeComponents.map(t => {
        const themeName = path.basename(t.path);
        return {
          name: themeName,
          value: t.path,
        };
      }),
    },
  ]);
}
