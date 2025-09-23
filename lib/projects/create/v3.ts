import { Separator } from '@inquirer/prompts';
import {
  marketplaceDistribution,
  oAuth,
  privateDistribution,
  staticAuth,
  EMPTY_PROJECT,
  PROJECT_WITH_APP,
  FEATURES,
} from '../../constants.js';
import { commands, lib } from '../../../lang/en.js';
import { listPrompt } from '../../prompts/promptUtils.js';
import {
  ComponentTemplate,
  ComponentTemplateChoice,
  ProjectTemplateRepoConfig,
} from '../../../types/Projects.js';
import { ProjectMetadata } from '@hubspot/project-parsing-lib/src/lib/project.js';
import chalk from 'chalk';
import { SelectProjectTemplatePromptResponse } from '../../prompts/selectProjectTemplatePrompt.js';
import { isV2Project } from '../platformVersion.js';
import path from 'path';
import { getConfigForPlatformVersion } from './legacy.js';
import { logError } from '../../errorHandlers/index.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { hasFeature } from '../../hasFeature.js';
import {
  AppEventsKey,
  PagesKey,
} from '@hubspot/project-parsing-lib/src/lib/constants.js';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';

export async function createV3App(
  providedAuth: string | undefined,
  providedDistribution: string | undefined
): Promise<{
  authType: string;
  distribution: string;
}> {
  let authType: string | undefined;

  if (
    providedAuth &&
    providedDistribution === marketplaceDistribution &&
    providedAuth !== oAuth
  ) {
    throw new Error(
      lib.projects.create.errors.invalidAuthDistCombo(
        providedAuth,
        providedDistribution
      )
    );
  }

  const distribution =
    providedDistribution ||
    (await listPrompt(lib.projects.create.prompt.distribution, {
      choices: [
        {
          name: lib.projects.create.prompt.marketPlaceDistribution,
          value: marketplaceDistribution,
        },
        {
          name: lib.projects.create.prompt.privateDistribution,
          value: privateDistribution,
        },
      ],
    }));

  if (distribution === marketplaceDistribution) {
    // This is the only valid auth type for marketplace
    authType = oAuth;
  } else {
    authType =
      providedAuth ||
      (await listPrompt(lib.projects.create.prompt.auth, {
        choices: [
          { name: lib.projects.create.prompt.staticAuth, value: staticAuth },
          { name: lib.projects.create.prompt.oauth, value: oAuth },
        ],
      }));
  }

  return {
    distribution: distribution,
    authType: authType,
  };
}

const componentTypeToGateMap: Record<string, ValueOf<typeof FEATURES>> = {
  [AppEventsKey]: FEATURES.APP_EVENTS,
  [PagesKey]: FEATURES.APPS_HOME,
  'workflow-action-tool': FEATURES.AGENT_TOOLS,
};

export async function calculateComponentTemplateChoices(
  components: ComponentTemplate[],
  authType: string | undefined,
  distribution: string | undefined,
  accountId: number,
  projectMetadata?: ProjectMetadata
): Promise<(ComponentTemplateChoice | Separator)[]> {
  const enabledComponents: (ComponentTemplateChoice | Separator)[] = [];
  const disabledComponents: (ComponentTemplateChoice | Separator)[] = [];

  for (const template of components) {
    const { supportedAuthTypes, supportedDistributions } = template;
    const disabledReasons = [];

    if (projectMetadata) {
      const componentMetadata = projectMetadata.components[template.type];

      if (!componentMetadata) {
        disabledReasons.push(
          commands.project.add.error.invalidComponentType(template.type)
        );
      } else {
        const { count, maxCount } = componentMetadata;

        if (count >= maxCount) {
          disabledReasons.push(
            commands.project.add.error.maxExceeded(maxCount)
          );
        }
      }
    }

    if (
      Array.isArray(supportedAuthTypes) &&
      authType &&
      !supportedAuthTypes.includes(authType.toLowerCase())
    ) {
      disabledReasons.push(
        commands.project.add.error.authTypeNotAllowed(authType)
      );
    }

    if (
      Array.isArray(supportedDistributions) &&
      distribution &&
      !supportedDistributions.includes(distribution.toLowerCase())
    ) {
      disabledReasons.push(
        commands.project.add.error.distributionNotAllowed(distribution)
      );
    }

    const templateGate =
      componentTypeToGateMap[template.cliSelector || template.type];
    if (templateGate) {
      const isUngated = await hasFeature(accountId, templateGate);
      if (!isUngated) {
        disabledReasons.unshift(
          commands.project.add.error.portalDoesNotHaveAccessToThisFeature(
            accountId
          )
        );
      }
    }

    if (disabledReasons.length > 0) {
      disabledComponents.push({
        name: `[${chalk.yellow('DISABLED')}] ${template.label} -`,
        value: template,
        disabled: disabledReasons.join(' '),
      });
    } else {
      enabledComponents.push({
        name: `${template.label} [${template.cliSelector || template.type}]`,
        value: template,
      });
    }
  }

  return disabledComponents.length
    ? [
        ...enabledComponents,
        new Separator(),
        ...disabledComponents,
        new Separator(),
      ]
    : [...enabledComponents];
}

type V3ComponentInfo = {
  authType?: string;
  distribution?: string;
  repoConfig?: ProjectTemplateRepoConfig;
  projectContents?: string;
  componentTemplateChoices?: (ComponentTemplateChoice | Separator)[];
};

export async function v3ComponentFlow(
  platformVersion: string,
  projectBase: string | undefined,
  providedAuth: string | undefined,
  providedDistribution: string | undefined,
  accountId: number
): Promise<V3ComponentInfo> {
  let repoConfig: ProjectTemplateRepoConfig | undefined = undefined;
  let authType: string | undefined;
  let distribution: string | undefined;

  try {
    repoConfig = await getConfigForPlatformVersion(platformVersion);
  } catch (error) {
    logError(error);
    return process.exit(EXIT_CODES.SUCCESS);
  }

  const projectContentsChoice =
    projectBase ||
    (await listPrompt(commands.project.create.prompts.parentComponents, {
      choices: [
        {
          name: commands.project.create.prompts.emptyProject,
          value: EMPTY_PROJECT,
        },
        { name: commands.project.create.prompts.app, value: PROJECT_WITH_APP },
      ],
    }));

  if (projectContentsChoice === PROJECT_WITH_APP) {
    const { authType: selectedAuthType, distribution: selectedDistribution } =
      await createV3App(providedAuth, providedDistribution);
    authType = selectedAuthType;
    distribution = selectedDistribution;
  }

  const componentTemplateChoices = await calculateComponentTemplateChoices(
    repoConfig?.components || [],
    authType,
    distribution,
    accountId
  );

  return {
    componentTemplateChoices,
    authType,
    distribution,
    projectContents: projectContentsChoice,
    repoConfig,
  };
}

export function generateComponentPaths({
  selectProjectTemplatePromptResponse,
  platformVersion,
  repoConfig,
  projectContents,
  authType,
  distribution,
}: {
  selectProjectTemplatePromptResponse: SelectProjectTemplatePromptResponse;
  platformVersion: string;
  repoConfig?: ProjectTemplateRepoConfig;
  projectContents?: string;
  authType?: string;
  distribution?: string;
}): string[] {
  if (!isV2Project(platformVersion)) {
    return [];
  }
  const components: string[] =
    selectProjectTemplatePromptResponse.componentTemplates?.map(
      (componentTemplate: ComponentTemplate) => {
        return path.join(platformVersion, componentTemplate.path);
      }
    ) || [];

  if (projectContents && projectContents !== EMPTY_PROJECT) {
    const parentComponent = repoConfig?.parentComponents?.find(
      possibleParent => {
        return (
          possibleParent.type === projectContents &&
          possibleParent.authType === authType &&
          possibleParent.distribution === distribution
        );
      }
    );

    if (parentComponent) {
      components.push(path.join(platformVersion, parentComponent.path));
    }
  }

  if (repoConfig?.defaultFiles) {
    components.push(path.join(platformVersion, repoConfig?.defaultFiles));
  }

  return components;
}
