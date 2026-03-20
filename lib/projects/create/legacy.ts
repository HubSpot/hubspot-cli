import { fetchRepoFile } from '@hubspot/local-dev-lib/api/github';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';
import {
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  PROJECT_COMPONENT_TYPES,
} from '../../constants.js';
import {
  ProjectTemplate,
  ComponentTemplate,
  ProjectTemplateRepoConfig,
} from '../../../types/Projects.js';
import { debugError } from '../../errorHandlers/index.js';
import { isV2Project } from '../platformVersion.js';
import { lib } from '../../../lang/en.js';

const PROJECT_TEMPLATE_PROPERTIES = ['name', 'label', 'path'];

export const EMPTY_PROJECT_TEMPLATE_NAME = 'no-template';

export async function getConfigForPlatformVersion(
  platformVersion: string
): Promise<ProjectTemplateRepoConfig> | never {
  let path = '';
  if (isV2Project(platformVersion)) {
    path = `${platformVersion}/`;
  }
  const { data } = await fetchRepoFile<ProjectTemplateRepoConfig>(
    HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    `${path}config.json`,
    DEFAULT_PROJECT_TEMPLATE_BRANCH
  );
  return data;
}

export async function getProjectComponentListFromRepo(
  platformVersion: string
): Promise<ComponentTemplate[]> {
  let config;

  try {
    config = await getConfigForPlatformVersion(platformVersion);
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
    throw new Error(lib.projects.create.errors.missingConfigFileTemplateSource);
  }

  if (!config || !config[PROJECT_COMPONENT_TYPES.PROJECTS]) {
    throw new Error(lib.projects.create.errors.noProjectsInConfig);
  }

  const templates = config[PROJECT_COMPONENT_TYPES.PROJECTS]!;

  const templatesContainAllProperties = templates.every(config =>
    PROJECT_TEMPLATE_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );

  if (!templatesContainAllProperties) {
    throw new Error(lib.projects.create.errors.missingPropertiesInConfig);
  }

  return templates;
}
