import { ArgumentsCamelCase } from 'yargs';
import { ProjectTemplateRepoConfig } from '../../../types/Projects.js';
import {
  selectProjectTemplatePrompt,
  SelectProjectTemplatePromptResponse,
  ProjectNameAndDestPromptResponse,
} from '../../prompts/selectProjectTemplatePrompt.js';
import { projectNameAndDestPrompt } from '../../prompts/projectNameAndDestPrompt.js';
import {
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  EMPTY_PROJECT,
} from '../../constants.js';
import { isV2Project } from '../platformVersion.js';
import { v2ComponentFlow } from './v2.js';
import { getProjectTemplateListFromRepo } from './legacy.js';
import { uiLogger } from '../../ui/logger.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../../types/Yargs.js';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';

export type ProjectCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    name?: string;
    dest?: string;
    templateSource?: RepoPath;
    template?: string;
    features?: string[];
    platformVersion: string;
    projectBase?: string;
    auth?: string;
    distribution?: string;
  };

export async function handleProjectCreationFlow(
  args: ArgumentsCamelCase<ProjectCreateArgs>
): Promise<{
  authType?: string;
  distribution?: string;
  repoConfig?: ProjectTemplateRepoConfig;
  projectContents?: string;
  selectProjectTemplatePromptResponse: SelectProjectTemplatePromptResponse;
  projectNameAndDestPromptResponse: ProjectNameAndDestPromptResponse;
}> {
  const {
    platformVersion,
    templateSource,
    projectBase,
    auth: providedAuth,
    distribution: providedDistribution,
  } = args;
  const repo = templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH;

  const projectNameAndDestPromptResponse = await projectNameAndDestPrompt(args);
  if (isV2Project(platformVersion)) {
    const {
      componentTemplateChoices,
      authType,
      distribution,
      repoConfig,
      projectContents,
    } = await v2ComponentFlow(
      platformVersion,
      projectBase,
      providedAuth,
      providedDistribution,
      args.derivedAccountId
    );

    const selectProjectTemplatePromptResponse =
      await selectProjectTemplatePrompt(
        args,
        undefined,
        projectContents !== EMPTY_PROJECT ? componentTemplateChoices : undefined
      );

    return {
      authType,
      distribution,
      repoConfig,
      projectContents,
      selectProjectTemplatePromptResponse,
      projectNameAndDestPromptResponse,
    };
  }

  const projectTemplates = await getProjectTemplateListFromRepo(
    repo,
    DEFAULT_PROJECT_TEMPLATE_BRANCH
  );

  if (!projectTemplates.length) {
    uiLogger.error(commands.project.create.errors.failedToFetchProjectList);
    process.exit(EXIT_CODES.ERROR);
  }

  const selectProjectTemplatePromptResponse = await selectProjectTemplatePrompt(
    args,
    projectTemplates!
  );
  return {
    selectProjectTemplatePromptResponse,
    projectNameAndDestPromptResponse,
  };
}
