import fs from 'fs';
import path from 'path';
import {
  sanitizeFileName,
  getCwd,
  untildify,
  isValidPath,
} from '@hubspot/local-dev-lib/path';
import { lib } from '../../lang/en.js';
import {
  PromptOptionsArg,
  ProjectNameAndDestPromptResponse,
} from './selectProjectTemplatePrompt.js';
import { promptUser } from './promptUtils.js';

import { PROJECT_CONFIG_FILE } from '../constants.js';

export async function projectNameAndDestPrompt(
  promptOptions: PromptOptionsArg
): Promise<ProjectNameAndDestPromptResponse> {
  const result = await promptUser<ProjectNameAndDestPromptResponse>([
    {
      name: 'name',
      message: lib.prompts.projectNameAndDestPrompt.enterName,
      when: !promptOptions.name,
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.projectNameAndDestPrompt.errors.nameRequired;
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: lib.prompts.projectNameAndDestPrompt.enterDest,
      when: !promptOptions.dest,
      default: (answers: ProjectNameAndDestPromptResponse) => {
        const projectName = sanitizeFileName(
          promptOptions.name || answers.name
        );
        return path.resolve(getCwd(), projectName);
      },
      validate: validateProjectDirectory,
      filter: (input: string) => {
        return untildify(input);
      },
    },
  ]);

  if (!result.name) {
    result.name = promptOptions.name!;
  }

  if (!result.dest) {
    result.dest = promptOptions.dest!;
  }

  return result;
}
export function validateProjectDirectory(input?: string): string | boolean {
  if (!input) {
    return lib.prompts.projectNameAndDestPrompt.errors.destRequired;
  }
  if (
    fs.existsSync(path.resolve(getCwd(), path.join(input, PROJECT_CONFIG_FILE)))
  ) {
    return lib.prompts.projectNameAndDestPrompt.errors.invalidDest;
  }
  if (!isValidPath(input)) {
    return lib.prompts.projectNameAndDestPrompt.errors.invalidCharacters;
  }
  return true;
}
