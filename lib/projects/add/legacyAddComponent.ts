import { ComponentTypes, ProjectConfig } from '../../../types/Projects.js';
import { findProjectComponents } from '../structure.js';
import { debugError } from '../../errorHandlers/index.js';
import { commands } from '../../../lang/en.js';
import { getProjectComponentListFromRepo } from '../create/legacy.js';
import { projectAddPrompt } from '../../prompts/projectAddPrompt.js';
import path from 'path';
import {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} from '../../constants.js';

import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { uiLogger } from '../../ui/logger.js';
import { trackCommandUsage } from '../../usageTracking.js';

export async function legacyAddComponent(
  args: { name?: string; type?: string },
  projectDir: string,
  projectConfig: ProjectConfig,
  derivedAccountId: number
) {
  // We currently only support adding private apps to projects
  let projectContainsPublicApp = false;
  try {
    const components = await findProjectComponents(projectDir);
    projectContainsPublicApp = components.some(
      c => c.type === ComponentTypes.PublicApp
    );
  } catch (err) {
    debugError(err);
  }

  if (projectContainsPublicApp) {
    throw new Error(commands.project.add.error.projectContainsPublicApp);
  }

  uiLogger.log(commands.project.add.creatingComponent(projectConfig.name));

  const components = await getProjectComponentListFromRepo(
    projectConfig.platformVersion
  );

  if (!components || !components.length) {
    throw new Error(commands.project.add.error.failedToFetchComponentList);
  }

  const projectAddPromptResponse = await projectAddPrompt(components, args);

  trackCommandUsage(
    'project-add',
    {
      type: projectAddPromptResponse.componentTemplate.type,
    },
    derivedAccountId
  );

  try {
    const componentPath = path.join(
      projectDir,
      projectConfig.srcDir,
      projectAddPromptResponse.name
    );

    await cloneGithubRepo(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
      componentPath,
      {
        sourceDir: projectAddPromptResponse.componentTemplate.path,
        branch: DEFAULT_PROJECT_TEMPLATE_BRANCH,
        hideLogs: true,
      }
    );

    uiLogger.success(
      commands.project.add.success(projectAddPromptResponse.name)
    );
  } catch (error) {
    throw new Error(commands.project.add.error.failedToDownloadComponent);
  }
}
