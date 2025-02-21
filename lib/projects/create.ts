import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchRepoFile } from '@hubspot/local-dev-lib/api/github';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';
import {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  PROJECT_COMPONENT_TYPES,
} from '../constants';
import { EXIT_CODES } from '../enums/exitCodes';
import { i18n } from '../lang';
import {
  ProjectTemplate,
  ComponentTemplate,
  ProjectTemplateRepoConfig,
} from '../../types/Projects';
import { debugError } from '../errorHandlers/index';

const i18nKey = 'lib.projects.create';

export const EMPTY_PROJECT_TEMPLATE_NAME = 'no-template';
const PROJECT_TEMPLATE_PROPERTIES = ['name', 'label', 'path', 'insertPath'];

export async function getProjectComponentListFromRepo(
  githubRef: string
): Promise<ComponentTemplate[]> {
  let config;

  try {
    const { data } = await fetchRepoFile<ProjectTemplateRepoConfig>(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
      'config.json',
      githubRef
    );
    config = data;
  } catch (err) {
    debugError(err);
  }

  if (config) {
    return config[PROJECT_COMPONENT_TYPES.COMPONENTS] || [];
  }
  return [];
}

export async function getProjectTemplateListFromRepo(
  templateSource: RepoPath,
  githubRef: string
): Promise<ProjectTemplate[]> {
  let config: ProjectTemplateRepoConfig;

  try {
    const { data } = await fetchRepoFile<ProjectTemplateRepoConfig>(
      templateSource,
      'config.json',
      githubRef
    );
    config = data;
  } catch (e) {
    debugError(e);
    logger.error(i18n(`${i18nKey}.errors.missingConfigFileTemplateSource`));
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!config || !config[PROJECT_COMPONENT_TYPES.PROJECTS]) {
    logger.error(i18n(`${i18nKey}.errors.noProjectsInConfig`));
    return process.exit(EXIT_CODES.ERROR);
  }

  const templates = config[PROJECT_COMPONENT_TYPES.PROJECTS]!;

  const templatesContainAllProperties = templates.every(config =>
    PROJECT_TEMPLATE_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );

  if (!templatesContainAllProperties) {
    logger.error(i18n(`${i18nKey}.errors.missingPropertiesInConfig`));
    return process.exit(EXIT_CODES.ERROR);
  }

  return templates;
}
