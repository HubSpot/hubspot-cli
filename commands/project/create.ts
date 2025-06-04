import { ArgumentsCamelCase, Argv } from 'yargs';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { logger } from '@hubspot/local-dev-lib/logger';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { trackCommandUsage } from '../../lib/usageTracking';
import { createProjectPrompt } from '../../lib/prompts/createProjectPrompt';
import {
  writeProjectConfig,
  getProjectConfig,
} from '../../lib/projects/config';
import {
  getProjectTemplateListFromRepo,
  EMPTY_PROJECT_TEMPLATE_NAME,
  getConfigForPlatformVersion,
} from '../../lib/projects/create';
import { i18n } from '../../lib/lang';
import { uiBetaTag, uiFeatureHighlight } from '../../lib/ui';
import { debugError, logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  PROJECT_CONFIG_FILE,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} from '../../lib/constants';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { ProjectConfig, ProjectTemplateRepoConfig } from '../../types/Projects';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { useV3Api } from '../../lib/projects/buildAndDeploy';
import { listPrompt } from '../../lib/prompts/promptUtils';
const inquirer = require('inquirer');
const command = 'create';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.create.describe`),
  false
);

type ProjectCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    name?: string;
    dest?: string;
    templateSource?: RepoPath;
    template?: string;
    platformVersion: string;
  };

const { v2023_2, v2025_1, v2025_2 } = PLATFORM_VERSIONS;

async function handler(
  args: ArgumentsCamelCase<ProjectCreateArgs>
): Promise<void> {
  const { derivedAccountId, platformVersion, templateSource } = args;

  if (templateSource && !templateSource.includes('/')) {
    logger.error(
      i18n(`commands.project.subcommands.create.errors.invalidTemplateSource`)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let projectTemplates;
  let componentTemplates;
  const repo = templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH;
  let componentTemplateChoices: unknown[] | undefined;
  let repoConfig: ProjectTemplateRepoConfig | undefined = undefined;
  let authType: string | undefined;
  let distribution: string | undefined;

  if (useV3Api(platformVersion)) {
    try {
      repoConfig = await getConfigForPlatformVersion(platformVersion);
    } catch (error) {
      logError(error);
      return process.exit(EXIT_CODES.SUCCESS);
    }

    distribution = await listPrompt(
      'How would you like to distribute your application?',
      {
        choices: [
          { name: 'On the HubSpot marketplace', value: 'marketplace' },
          { name: 'Privately', value: 'private' },
        ],
      }
    );

    if (distribution === 'marketplace') {
      // This is the only valid auth type for marketplace
      authType = 'oauth';
    } else {
      authType = await listPrompt(
        'What type of authentication would you like your application to use',
        {
          choices: [
            { name: 'Static Auth', value: 'static' },
            { name: 'OAuth', value: 'oauth' },
          ],
        }
      );
    }

    componentTemplates = repoConfig?.components || [];

    const enabledComponents: unknown[] = [];
    const disabledComponents: unknown[] = [];

    componentTemplates.forEach(template => {
      let disabled: boolean | string = false;

      // @ts-expect-error
      const { supportedAuthTypes, supportedDistributions } = template;

      if (
        Array.isArray(supportedAuthTypes) &&
        !supportedAuthTypes.includes(authType)
      ) {
        disabled = `Auth type '${authType}' not allowed`;
      } else if (
        Array.isArray(supportedDistributions) &&
        !supportedDistributions.includes(distribution)
      ) {
        disabled = `Distribution '${distribution}' not allowed`;
      }

      const component = {
        name: `${disabled ? `[${chalk.yellow('DISABLED')}] ` : ''}${template.label}`,
        value: template,
        disabled,
      };

      if (disabled) {
        disabledComponents.push(component);
      } else {
        enabledComponents.push(component);
      }
    });

    componentTemplateChoices = disabledComponents.length
      ? [...enabledComponents, new inquirer.Separator(), ...disabledComponents]
      : [...enabledComponents];
  } else {
    projectTemplates = await getProjectTemplateListFromRepo(repo, 'main');

    if (!projectTemplates.length) {
      logger.error(
        i18n(
          `commands.project.subcommands.create.errors.failedToFetchProjectList`
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const createProjectPromptResponse = await createProjectPrompt(
    args,
    // @ts-expect-error
    projectTemplates,
    componentTemplateChoices
  );

  // @ts-expect-error
  const projectDest = path.resolve(getCwd(), createProjectPromptResponse.dest);

  trackCommandUsage(
    'project-create',
    {
      type:
        // @ts-expect-error
        createProjectPromptResponse.projectTemplate?.name ||
        // @ts-expect-error
        createProjectPromptResponse.componentTemplates
          // @ts-expect-error
          .map((item: never) => item.label)
          .join(','),
    },
    derivedAccountId
  );

  const {
    projectConfig: existingProjectConfig,
    projectDir: existingProjectDir,
  } = await getProjectConfig(projectDest);

  // Exit if the target destination is within an existing project
  if (
    existingProjectConfig &&
    existingProjectDir &&
    projectDest.startsWith(existingProjectDir)
  ) {
    logger.error(
      i18n(`commands.project.subcommands.create.errors.cannotNestProjects`, {
        projectDir: existingProjectDir,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const components: string[] = Array.from(
    new Set<string>(
      // @ts-expect-error
      createProjectPromptResponse.componentTemplates
        ?.map((item: { path: string; parentType?: string }) => {
          let parent = undefined;
          if (item.parentType) {
            // @ts-expect-error Fix the type
            parent = repoConfig.parentComponents.find(possibleParent => {
              return (
                possibleParent.type === item.parentType &&
                possibleParent.authType === authType &&
                possibleParent.distribution === distribution
              );
            });
          }
          return [
            path.join(platformVersion, item.path),
            parent ? path.join(platformVersion, parent.path) : undefined,
          ];
        })
        .flat()
    )
  );

  // @ts-expect-error
  if (repoConfig?.tooling) {
    // @ts-expect-error
    repoConfig.tooling.forEach((tooling: { path: string }) => {
      components.push(path.join(platformVersion, tooling.path));
    });
  }

  if (repoConfig?.defaultFiles) {
    components.push(path.join(platformVersion, repoConfig?.defaultFiles));
  }

  logger.debug(components);

  try {
    await cloneGithubRepo(repo, projectDest, {
      sourceDir:
        // @ts-expect-error
        createProjectPromptResponse.projectTemplate?.path || components,
      hideLogs: true,
      // TODO: Change this to main when it's merged
      branch: 'jy/2025.2',
    });
  } catch (err) {
    debugError(err);
    logger.error(
      i18n(`commands.project.subcommands.create.errors.failedToDownloadProject`)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const projectConfigPath = path.join(projectDest, PROJECT_CONFIG_FILE);

  const parsedConfigFile: ProjectConfig = JSON.parse(
    fs.readFileSync(projectConfigPath).toString()
  );

  writeProjectConfig(projectConfigPath, {
    ...parsedConfigFile,
    // @ts-expect-error
    name: createProjectPromptResponse.name,
  });

  // If the template is 'no-template', we need to manually create a src directory
  if (
    // @ts-expect-error
    createProjectPromptResponse.projectTemplate?.name ===
    EMPTY_PROJECT_TEMPLATE_NAME
  ) {
    fs.ensureDirSync(path.join(projectDest, 'src'));
  }

  logger.log('');
  logger.success(
    i18n(`commands.project.subcommands.create.logs.success`, {
      // @ts-expect-error
      projectName: createProjectPromptResponse.name,
      projectDest,
    })
  );

  logger.log('');
  logger.log(
    chalk.bold(i18n(`commands.project.subcommands.create.logs.welcomeMessage`))
  );
  uiFeatureHighlight([
    'projectCommandTip',
    'projectUploadCommand',
    'projectDevCommand',
    'projectInstallDepsCommand',
    'projectHelpCommand',
    'feedbackCommand',
    'sampleProjects',
  ]);
  process.exit(EXIT_CODES.SUCCESS);
}

function projectCreateBuilder(yargs: Argv): Argv<ProjectCreateArgs> {
  yargs.options({
    name: {
      describe: i18n(
        `commands.project.subcommands.create.options.name.describe`
      ),
      type: 'string',
    },
    dest: {
      describe: i18n(
        `commands.project.subcommands.create.options.dest.describe`
      ),
      type: 'string',
    },
    template: {
      describe: i18n(
        `commands.project.subcommands.create.options.template.describe`
      ),
      type: 'string',
    },
    'template-source': {
      describe: i18n(
        `commands.project.subcommands.create.options.templateSource.describe`
      ),
      type: 'string',
    },
    'platform-version': {
      describe: undefined,
      type: 'string',
      choices: [v2023_2, v2025_1, v2025_2],
      default: v2023_2,
    },
  });

  yargs.example([
    [
      '$0 project create',
      i18n(`commands.project.subcommands.create.examples.default`),
    ],
  ]);
  yargs.example([
    [
      '$0 project create --template-source HubSpot/ui-extensions-examples',
      i18n(`commands.project.subcommands.create.examples.templateSource`),
    ],
  ]);

  return yargs as Argv<ProjectCreateArgs>;
}

const builder = makeYargsBuilder<ProjectCreateArgs>(
  projectCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const projectCreateCommand: YargsCommandModule<unknown, ProjectCreateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectCreateCommand;
