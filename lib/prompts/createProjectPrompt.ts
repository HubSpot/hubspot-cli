import fs from 'fs';
import path from 'path';
import {
  getCwd,
  sanitizeFileName,
  isValidPath,
  untildify,
} from '@hubspot/local-dev-lib/path';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { ProjectTemplate } from '../../types/Projects';
import { PROJECT_CONFIG_FILE } from '../constants';

const i18nKey = 'lib.prompts.createProjectPrompt';

function validateProjectDirectory(input?: string): string | boolean {
  if (!input) {
    return i18n(`${i18nKey}.errors.destRequired`);
  }
  if (
    fs.existsSync(path.resolve(getCwd(), path.join(input, PROJECT_CONFIG_FILE)))
  ) {
    return i18n(`${i18nKey}.errors.invalidDest`);
  }
  if (!isValidPath(input)) {
    return i18n(`${i18nKey}.errors.invalidCharacters`);
  }
  return true;
}

function findTemplateByNameOrLabel(
  projectTemplates: ProjectTemplate[],
  templateNameOrLabel: string
): ProjectTemplate | undefined {
  return projectTemplates.find(
    t => t.name === templateNameOrLabel || t.label === templateNameOrLabel
  );
}

type CreateProjectPromptResponse = {
  name: string;
  dest: string;
  projectTemplate?: ProjectTemplate;
};

type CreateProjectPromptResponseWithTemplate = {
  name: string;
  dest: string;
  projectTemplate: ProjectTemplate;
};

type CreateProjectPromptResponseWithoutTemplate = {
  name: string;
  dest: string;
  projectTemplate?: undefined;
};

type PromptOptionsArg = {
  name?: string;
  dest?: string;
  template?: string;
};

// Includes `projectTemplate` in the return value if `projectTemplates` is provided
export async function createProjectPrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates: ProjectTemplate[]
): Promise<CreateProjectPromptResponseWithTemplate>;
export async function createProjectPrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: undefined
): Promise<CreateProjectPromptResponseWithoutTemplate>;
export async function createProjectPrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: ProjectTemplate[]
) {
  const createProjectFromTemplate =
    !!projectTemplates && projectTemplates.length > 0;

  const providedTemplateIsValid =
    createProjectFromTemplate &&
    !!promptOptions.template &&
    !!findTemplateByNameOrLabel(projectTemplates, promptOptions.template);

  const result = await promptUser<CreateProjectPromptResponse>([
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      when: !promptOptions.name,
      validate: (input?: string) => {
        if (!input) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: i18n(`${i18nKey}.enterDest`),
      when: !promptOptions.dest,
      default: answers => {
        const projectName = sanitizeFileName(
          promptOptions.name || answers.name
        );
        return path.resolve(getCwd(), projectName);
      },
      validate: validateProjectDirectory,
      filter: input => {
        return untildify(input);
      },
    },
    {
      name: 'projectTemplate',
      message: () => {
        return promptOptions.template && !providedTemplateIsValid
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when: createProjectFromTemplate && !providedTemplateIsValid,
      type: 'list',
      choices: createProjectFromTemplate
        ? projectTemplates.map(template => {
            return {
              name: template.label,
              value: template,
            };
          })
        : undefined,
    },
  ]);

  if (!result.name) {
    result.name = promptOptions.name!;
  }

  if (!result.dest) {
    result.dest = promptOptions.dest!;
  }

  if (providedTemplateIsValid) {
    result.projectTemplate = findTemplateByNameOrLabel(
      projectTemplates!,
      promptOptions.template!
    );
  }

  if (projectTemplates && projectTemplates.length > 0) {
    if (!result.projectTemplate) {
      throw new Error(i18n(`${i18nKey}.errors.projectTemplateRequired`));
    }
    return result;
  }

  return result;
}
