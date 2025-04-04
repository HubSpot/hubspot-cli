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

type CreateProjectPromptResponse = {
  name: string;
  dest: string;
  projectTemplate?: ProjectTemplate;
};

function findTemplateByNameOrLabel(
  projectTemplates: ProjectTemplate[],
  templateNameOrLabel: string
): ProjectTemplate | undefined {
  return projectTemplates.find(
    t => t.name === templateNameOrLabel || t.label === templateNameOrLabel
  );
}

export async function createProjectPrompt(
  promptOptions: {
    name?: string;
    dest?: string;
    template?: string;
  },
  projectTemplates?: ProjectTemplate[]
): Promise<CreateProjectPromptResponse> {
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
  ]);

  if (!result.name) {
    result.name = promptOptions.name!;
  }

  if (!result.dest) {
    result.dest = promptOptions.dest!;
  }

  if (providedTemplateIsValid) {
    result.projectTemplate = findTemplateByNameOrLabel(
      projectTemplates,
      promptOptions.template!
    );
  }

  return result;
}
