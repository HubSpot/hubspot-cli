import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.previewPrompt';

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

export async function previewProjectPrompt(
  themeComponents: { path: string }[]
): Promise<PreviewProjectPromptResponse> {
  return promptUser<PreviewProjectPromptResponse>([
    {
      name: 'themeComponentPath',
      message: i18n(`${i18nKey}.themeProjectSelect`),
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
