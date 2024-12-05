import fs from 'fs';
import path from 'path';
import {
  getCwd,
  sanitizeFileName,
  isValidPath,
  untildify,
} from '@hubspot/local-dev-lib/path';
import {
  PROJECT_COMPONENT_TYPES,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} from '../constants';
import { promptUser } from './promptUtils';
import { fetchFileFromRepository } from '@hubspot/local-dev-lib/github';
import { i18n } from '../lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../enums/exitCodes';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';

const i18nKey = 'lib.prompts.createProjectPrompt';

const PROJECT_PROPERTIES = ['name', 'label', 'path', 'insertPath'];

type ProjectsConfig = {
  projects?: ProjectProperties[];
};

type ProjectProperties = {
  name: string;
  label: string;
  path: string;
  insertPath: string;
};

type CreateProjectPromptResponse = {
  name: string;
  dest: string;
  template: ProjectProperties;
};

function hasAllProperties(projectList: ProjectProperties[]): boolean {
  return projectList.every(config =>
    PROJECT_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );
}

async function createTemplateOptions(
  templateSource: RepoPath,
  githubRef: string
): Promise<ProjectProperties[]> {
  const hasCustomTemplateSource = Boolean(templateSource);
  const branch = hasCustomTemplateSource
    ? DEFAULT_PROJECT_TEMPLATE_BRANCH
    : githubRef;

  const config: ProjectsConfig = await fetchFileFromRepository(
    templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    'config.json',
    branch
  );

  if (!config || !config[PROJECT_COMPONENT_TYPES.PROJECTS]) {
    logger.error(i18n(`${i18nKey}.errors.noProjectsInConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (!hasAllProperties(config[PROJECT_COMPONENT_TYPES.PROJECTS]!)) {
    logger.error(i18n(`${i18nKey}.errors.missingPropertiesInConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  return config[PROJECT_COMPONENT_TYPES.PROJECTS]!;
}

function findTemplate(
  projectTemplates: ProjectProperties[],
  templateNameOrLabel: string
): ProjectProperties | undefined {
  return projectTemplates.find(
    t => t.name === templateNameOrLabel || t.label === templateNameOrLabel
  );
}

export async function createProjectPrompt(
  githubRef: string,
  promptOptions: {
    name: string;
    dest: string;
    template: string;
    templateSource: RepoPath;
  },
  skipTemplatePrompt = false
): Promise<CreateProjectPromptResponse> {
  let projectTemplates: ProjectProperties[] = [];
  let selectedTemplate;

  if (!skipTemplatePrompt) {
    projectTemplates = await createTemplateOptions(
      promptOptions.templateSource,
      githubRef
    );

    selectedTemplate =
      promptOptions.template &&
      findTemplate(projectTemplates, promptOptions.template);
  }

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
          answers.name || promptOptions.name
        );
        return path.resolve(getCwd(), projectName);
      },
      validate: (input?: string) => {
        if (!input) {
          return i18n(`${i18nKey}.errors.destRequired`);
        }
        if (fs.existsSync(input)) {
          return i18n(`${i18nKey}.errors.invalidDest`);
        }
        if (!isValidPath(input)) {
          return i18n(`${i18nKey}.errors.invalidCharacters`);
        }
        return true;
      },
      filter: input => {
        return untildify(input);
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !findTemplate(projectTemplates, promptOptions.template)
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when: !skipTemplatePrompt && !selectedTemplate,
      type: 'list',
      choices: projectTemplates.map(template => {
        return {
          name: template.label,
          value: template,
        };
      }),
    },
  ]);

  if (selectedTemplate) {
    result.template = selectedTemplate;
  }

  return result;
}
