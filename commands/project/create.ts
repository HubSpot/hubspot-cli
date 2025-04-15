import { ArgumentsCamelCase, Argv } from 'yargs';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  fetchReleaseData,
  cloneGithubRepo,
} from '@hubspot/local-dev-lib/github';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { trackCommandUsage } from '../../lib/usageTracking';
import { createProjectPrompt } from '../../lib/prompts/createProjectPrompt';
import { writeProjectConfig, getProjectConfig } from '../../lib/projects';
import {
  getProjectTemplateListFromRepo,
  EMPTY_PROJECT_TEMPLATE_NAME,
} from '../../lib/projects/create';
import { i18n } from '../../lib/lang';
import { uiBetaTag, uiFeatureHighlight } from '../../lib/ui';
import { debugError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  PROJECT_CONFIG_FILE,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} from '../../lib/constants';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { ProjectConfig } from '../../types/Projects';

const i18nKey = 'commands.project.subcommands.create';

const command = 'create';
const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type ProjectCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    name?: string;
    dest?: string;
    templateSource?: RepoPath;
    template?: string;
  };

async function handler(args: ArgumentsCamelCase<ProjectCreateArgs>) {
  const { derivedAccountId } = args;

  let latestRepoReleaseTag: string | null = null;
  let templateSource = args.templateSource;

  if (!templateSource) {
    templateSource = HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH;
    try {
      const releaseData = await fetchReleaseData(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
      );
      if (releaseData) {
        latestRepoReleaseTag = releaseData.tag_name;
      }
    } catch (err) {
      logger.error(i18n(`${i18nKey}.error.failedToFetchProjectList`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (!templateSource || !templateSource.includes('/')) {
    logger.error(i18n(`${i18nKey}.error.invalidTemplateSource`));
    process.exit(EXIT_CODES.ERROR);
  }

  const projectTemplates = await getProjectTemplateListFromRepo(
    templateSource,
    latestRepoReleaseTag || DEFAULT_PROJECT_TEMPLATE_BRANCH
  );

  if (!projectTemplates.length) {
    logger.error(i18n(`${i18nKey}.error.failedToFetchProjectList`));
    process.exit(EXIT_CODES.ERROR);
  }

  const createProjectPromptResponse = await createProjectPrompt(
    args,
    projectTemplates
  );
  const projectDest = path.resolve(getCwd(), createProjectPromptResponse.dest);

  trackCommandUsage(
    'project-create',
    { type: createProjectPromptResponse.projectTemplate.name },
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
      i18n(`${i18nKey}.errors.cannotNestProjects`, {
        projectDir: existingProjectDir,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await cloneGithubRepo(templateSource, projectDest, {
      sourceDir: createProjectPromptResponse.projectTemplate.path,
      tag: latestRepoReleaseTag || undefined,
      hideLogs: true,
    });
  } catch (err) {
    debugError(err);
    logger.error(i18n(`${i18nKey}.errors.failedToDownloadProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  const projectConfigPath = path.join(projectDest, PROJECT_CONFIG_FILE);

  const parsedConfigFile: ProjectConfig = JSON.parse(
    fs.readFileSync(projectConfigPath).toString()
  );

  writeProjectConfig(projectConfigPath, {
    ...parsedConfigFile,
    name: createProjectPromptResponse.name,
  });

  // If the template is 'no-template', we need to manually create a src directory
  if (
    createProjectPromptResponse.projectTemplate.name ===
    EMPTY_PROJECT_TEMPLATE_NAME
  ) {
    fs.ensureDirSync(path.join(projectDest, 'src'));
  }

  logger.log('');
  logger.success(
    i18n(`${i18nKey}.logs.success`, {
      projectName: createProjectPromptResponse.name,
      projectDest,
    })
  );

  logger.log('');
  logger.log(chalk.bold(i18n(`${i18nKey}.logs.welcomeMessage`)));
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
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    template: {
      describe: i18n(`${i18nKey}.options.template.describe`),
      type: 'string',
    },
    'template-source': {
      describe: i18n(`${i18nKey}.options.templateSource.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project create', i18n(`${i18nKey}.examples.default`)]]);
  yargs.example([
    [
      '$0 project create --template-source HubSpot/ui-extensions-examples',
      i18n(`${i18nKey}.examples.templateSource`),
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
