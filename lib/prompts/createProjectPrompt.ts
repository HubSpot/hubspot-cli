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

function validateProjectDirectory(input?: string): string | boolean {
  if (!input) {
    return i18n(`lib.prompts.createProjectPrompt.errors.destRequired`);
  }
  if (
    fs.existsSync(path.resolve(getCwd(), path.join(input, PROJECT_CONFIG_FILE)))
  ) {
    return i18n(`lib.prompts.createProjectPrompt.errors.invalidDest`);
  }
  if (!isValidPath(input)) {
    return i18n(`lib.prompts.createProjectPrompt.errors.invalidCharacters`);
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
  projectTemplates: ProjectTemplate[],
  componentTemplates?: never[]
): Promise<CreateProjectPromptResponseWithTemplate>;
export async function createProjectPrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: undefined,
  componentTemplates?: never[]
): Promise<CreateProjectPromptResponseWithoutTemplate>;
export async function createProjectPrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: ProjectTemplate[],
  componentTemplates?: never[]
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
      message: i18n(`lib.prompts.createProjectPrompt.enterName`),
      when: !promptOptions.name,
      validate: (input?: string) => {
        if (!input) {
          return i18n(`lib.prompts.createProjectPrompt.errors.nameRequired`);
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: i18n(`lib.prompts.createProjectPrompt.enterDest`),
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
          ? i18n(`lib.prompts.createProjectPrompt.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`lib.prompts.createProjectPrompt.selectTemplate`);
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
    {
      // @ts-ignore
      name: 'componentTemplates',
      message: 'Which components would you like your project to include?',
      when: !(createProjectFromTemplate && !providedTemplateIsValid),
      type: 'checkbox',
      choices: componentTemplates,
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
      throw new Error(
        i18n(`lib.prompts.createProjectPrompt.errors.projectTemplateRequired`)
      );
    }
    return result;
  }

  return result;
}
