import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import {
  deployProject,
  fetchProject,
} from '@hubspot/local-dev-lib/api/projects';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { useV3Api } from '../../lib/projects/buildAndDeploy';
import { trackCommandUsage } from '../../lib/usageTracking';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { getProjectConfig } from '../../lib/projects/config';
import { pollDeployStatus } from '../../lib/projects/buildAndDeploy';
import { getProjectDetailUrl } from '../../lib/projects/urls';
import { projectNamePrompt } from '../../lib/prompts/projectNamePrompt';
import { promptUser } from '../../lib/prompts/promptUtils';
import { i18n } from '../../lib/lang';
import { uiBetaTag, uiLine, uiLink } from '../../lib/ui';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiCommandReference, uiAccountDescription } from '../../lib/ui';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import {
  loadProfile,
  logProfileFooter,
  logProfileHeader,
  exitIfUsingProfiles,
} from '../../lib/projectProfiles';

const command = 'deploy';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.deploy.describe`),
  false
);

export type ProjectDeployArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    project?: string;
    build?: number;
    buildId?: number;
    profile?: string;
  };

function validateBuildId(
  buildId: number,
  deployedBuildId: number | undefined,
  latestBuildId: number,
  projectName: string | undefined,
  accountId: number
): boolean | string {
  if (Number(buildId) > latestBuildId) {
    return i18n(
      `commands.project.subcommands.deploy.errors.buildIdDoesNotExist`,
      {
        buildId: buildId,
        projectName: projectName!,
        linkToProject: uiLink(
          i18n(`commands.project.subcommands.deploy.errors.viewProjectsBuilds`),
          getProjectDetailUrl(projectName!, accountId)!
        ),
      }
    );
  }
  if (Number(buildId) === deployedBuildId) {
    return i18n(
      `commands.project.subcommands.deploy.errors.buildAlreadyDeployed`,
      {
        buildId: buildId,
        linkToProject: uiLink(
          i18n(`commands.project.subcommands.deploy.errors.viewProjectsBuilds`),
          getProjectDetailUrl(projectName!, accountId)!
        ),
      }
    );
  }
  return true;
}

async function handler(
  args: ArgumentsCamelCase<ProjectDeployArgs>
): Promise<void> {
  const { derivedAccountId } = args;
  const accountConfig = getAccountConfig(derivedAccountId);
  const { project: projectOption, buildId: buildIdOption } = args;
  const accountType = accountConfig && accountConfig.accountType;

  const { projectConfig, projectDir } = await getProjectConfig(undefined, true);

  let targetAccountId: number | undefined;

  if (useV3Api(projectConfig?.platformVersion)) {
    if (args.profile) {
      logProfileHeader(args.profile);

      const profile = await loadProfile(
        projectConfig,
        projectDir,
        args.profile
      );

      if (!profile) {
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }
      targetAccountId = profile.accountId;

      logProfileFooter(profile);
    } else {
      // A profile must be specified if this project has profiles configured
      await exitIfUsingProfiles(projectConfig, projectDir);
    }
  }

  if (!targetAccountId) {
    targetAccountId = derivedAccountId;
  }

  trackCommandUsage(
    'project-deploy',
    accountType ? { type: accountType } : undefined,
    targetAccountId
  );

  let projectName = projectOption;

  if (!projectOption && projectConfig) {
    projectName = projectConfig.name;
  }

  const namePromptResponse = await projectNamePrompt(targetAccountId, {
    project: projectName,
  });
  projectName = namePromptResponse.projectName;

  let buildIdToDeploy = buildIdOption;

  try {
    const {
      data: { latestBuild, deployedBuildId },
    } = await fetchProject(targetAccountId, projectName);

    if (!latestBuild || !latestBuild.buildId) {
      logger.error(i18n(`commands.project.subcommands.deploy.errors.noBuilds`));
      return process.exit(EXIT_CODES.ERROR);
    }

    if (buildIdToDeploy) {
      const validationResult = validateBuildId(
        buildIdToDeploy,
        deployedBuildId,
        latestBuild.buildId,
        projectName,
        targetAccountId
      );
      if (validationResult !== true) {
        logger.error(validationResult);
        return process.exit(EXIT_CODES.ERROR);
      }
    } else {
      const deployBuildIdPromptResponse = await promptUser({
        name: 'buildId',
        message: i18n(
          `commands.project.subcommands.deploy.deployBuildIdPrompt`
        ),
        default:
          latestBuild.buildId === deployedBuildId
            ? undefined
            : latestBuild.buildId,
        validate: buildId =>
          validateBuildId(
            buildId,
            deployedBuildId,
            latestBuild.buildId,
            projectName,
            targetAccountId
          ),
      });
      buildIdToDeploy = deployBuildIdPromptResponse.buildId;
    }

    if (!buildIdToDeploy) {
      logger.error(
        i18n(`commands.project.subcommands.deploy.errors.noBuildId`)
      );
      return process.exit(EXIT_CODES.ERROR);
    }

    const { data: deployResp } = await deployProject(
      targetAccountId,
      projectName,
      buildIdToDeploy,
      useV3Api(projectConfig?.platformVersion)
    );

    if (!deployResp) {
      logger.error(i18n(`commands.project.subcommands.deploy.errors.deploy`));
      return process.exit(EXIT_CODES.ERROR);
    }

    await pollDeployStatus(
      targetAccountId,
      projectName,
      Number(deployResp.id),
      buildIdToDeploy
    );
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      logger.error(
        i18n(`commands.project.subcommands.deploy.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountIdentifier: uiAccountDescription(targetAccountId),
          command: uiCommandReference('hs project upload'),
        })
      );
    } else if (isHubSpotHttpError(e) && e.status === 400) {
      logger.error(e.message);
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: targetAccountId,
          request: 'project deploy',
        })
      );
    }
    return process.exit(EXIT_CODES.ERROR);
  }
}

function projectDeployBuilder(yargs: Argv): Argv<ProjectDeployArgs> {
  yargs.options({
    project: {
      describe: i18n(
        `commands.project.subcommands.deploy.options.project.describe`
      ),
      type: 'string',
    },
    build: {
      alias: ['build-id'],
      describe: i18n(
        `commands.project.subcommands.deploy.options.build.describe`
      ),
      type: 'number',
    },
    profile: {
      alias: ['p'],
      describe: i18n(
        `commands.project.subcommands.deploy.options.profile.describe`
      ),
      type: 'string',
      hidden: true,
    },
  });

  yargs.conflicts('profile', 'project');
  yargs.conflicts('profile', 'account');

  yargs.example([
    [
      '$0 project deploy',
      i18n(`commands.project.subcommands.deploy.examples.default`),
    ],
    [
      '$0 project deploy --project="my-project" --build=5',
      i18n(`commands.project.subcommands.deploy.examples.withOptions`),
    ],
  ]);

  return yargs as Argv<ProjectDeployArgs>;
}

const builder = makeYargsBuilder<ProjectDeployArgs>(
  projectDeployBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const projectDeployCommand: YargsCommandModule<unknown, ProjectDeployArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default projectDeployCommand;
