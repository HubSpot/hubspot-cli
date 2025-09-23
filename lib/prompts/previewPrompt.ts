import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils.js';
import { i18n } from '../lang.js';

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
      message: i18n(`lib.prompts.previewPrompt.enterSrc`),
      when: !promptOptions.src,
      default: '.',
      validate: (input?: string) => {
        if (!input) {
          return i18n(`lib.prompts.previewPrompt.errors.srcRequired`);
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: i18n(`lib.prompts.previewPrompt.enterDest`),
      when: !promptOptions.dest,
      default: path.basename(getCwd()),
      validate: (input?: string) => {
        if (!input) {
          return i18n(`lib.prompts.previewPrompt.errors.destRequired`);
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
      message: i18n(`lib.prompts.previewPrompt.themeProjectSelect`),
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
