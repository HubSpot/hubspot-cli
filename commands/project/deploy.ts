import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { projectNamePrompt } from '../../lib/prompts/projectNamePrompt.js';
import { projectProfilePrompt } from '../../lib/prompts/projectProfilePrompt.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { DeployJsonOutput, DeploySchema } from '../../lib/jsonOutput.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { loadProfile } from '../../lib/projects/projectProfiles.js';
import { PROJECT_DEPLOY_TEXT } from '../../lib/constants.js';
import { commands } from '../../lang/en.js';
import {
  handleProjectDeploy,
  validateBuildIdForDeploy,
  logDeployErrors,
} from '../../lib/projects/deploy.js';
import { validateBuildForRelease } from '../../lib/projects/release.js';
import { getLastSuccessfulBuild } from '../../lib/projects/builds.js';

const command = 'deploy';
const describe = commands.project.deploy.describe;

export type ProjectDeployArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<DeployJsonOutput> & {
    project?: string;
    build?: number;
    buildId?: number;
    profile?: string;
    deployLatestBuild: boolean;
    force: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectDeployArgs>
): Promise<void> {
  const {
    derivedAccountId,
    project: projectOption,
    buildId: buildIdOption,
    force: forceOption,
    deployLatestBuild: deployLatestBuildOption,
    profile: profileOption,
    useEnv: useEnvOption,
    exit,
    addUsageMetadata,
    addJsonOutput,
  } = args;
  const accountConfig = getConfigAccountById(derivedAccountId);
  const accountType = accountConfig && accountConfig.accountType;
  let targetAccountId: number | undefined;

  const { projectConfig, projectDir } = await getProjectConfig();

  let isInProjectDirectory = false;

  // Validate project config, but it's valid to run this command from outside a project dir
  try {
    validateProjectConfig(projectConfig, projectDir);
    isInProjectDirectory = true;
  } catch (e) {}

  if (
    isInProjectDirectory &&
    !isLegacyProject(projectConfig?.platformVersion)
  ) {
    try {
      const profileName = await projectProfilePrompt(
        projectDir!,
        projectConfig!,
        profileOption,
        !!useEnvOption
      );

      if (profileName) {
        // Use loadProfile instead of loadAndValidateProfile because the local
        // profile does not need to be valid to successfully deploy
        const profile = loadProfile(projectConfig, projectDir, profileName);
        targetAccountId = profile.accountId;

        uiLogger.log(
          commands.project.deploy.profileMessage(profileName, targetAccountId)
        );
        uiLogger.log('');
      }
    } catch (error) {
      logError(error);
      return exit(EXIT_CODES.ERROR);
    }
  }

  if (!targetAccountId) {
    targetAccountId = derivedAccountId;
  }

  if (accountType) {
    addUsageMetadata({ type: accountType });
  }

  let projectName = projectOption;

  if (!projectOption && projectConfig) {
    projectName = projectConfig.name;
  }

  const namePromptResponse = await projectNamePrompt(targetAccountId, {
    project: projectName,
  });
  projectName = namePromptResponse.projectName;

  let buildIdToDeploy = buildIdOption;
  let deploySuccess = false;

  try {
    const {
      data: { latestBuild, deployedBuildId },
    } = await fetchProject(targetAccountId, projectName);

    if (!latestBuild || !latestBuild.buildId) {
      uiLogger.error(commands.project.deploy.errors.noBuilds);
      return exit(EXIT_CODES.ERROR);
    }

    if (buildIdToDeploy) {
      const validationResult = validateBuildIdForDeploy(
        buildIdToDeploy,
        deployedBuildId,
        latestBuild.buildId,
        projectName,
        targetAccountId
      );
      if (validationResult !== true) {
        uiLogger.error(validationResult.toString());
        return exit(EXIT_CODES.ERROR);
      }
    } else {
      const lastSuccessfulBuild = await getLastSuccessfulBuild(
        targetAccountId,
        projectName,
        latestBuild
      );

      if (!lastSuccessfulBuild) {
        uiLogger.error(commands.project.deploy.errors.noSuccessfulBuilds);
        return exit(EXIT_CODES.ERROR);
      }

      if (deployLatestBuildOption) {
        buildIdToDeploy = lastSuccessfulBuild.buildId;
      } else {
        const deployBuildIdPromptResponse = await promptUser({
          name: 'buildId',
          message: commands.project.deploy.deployBuildIdPrompt,
          default:
            lastSuccessfulBuild.buildId === deployedBuildId
              ? undefined
              : lastSuccessfulBuild.buildId,
          validate: buildId =>
            validateBuildIdForDeploy(
              buildId,
              deployedBuildId,
              latestBuild.buildId,
              projectName,
              targetAccountId
            ),
        });
        buildIdToDeploy = deployBuildIdPromptResponse.buildId;
      }
    }

    if (!buildIdToDeploy) {
      uiLogger.error(commands.project.deploy.errors.noBuildId);
      return exit(EXIT_CODES.ERROR);
    }

    try {
      const supportsReleases = await validateBuildForRelease(
        targetAccountId,
        projectName,
        buildIdToDeploy
      );

      // The deploy verb is not compatible with builds that leverage releases. Use release create instead.
      if (supportsReleases) {
        uiLogger.error(
          commands.project.deploy.errors.notSupportedForBuildVersion
        );
        return exit(EXIT_CODES.ERROR);
      }
    } catch {
      return exit(EXIT_CODES.ERROR);
    }

    const deployResult = await handleProjectDeploy(
      targetAccountId,
      projectName,
      buildIdToDeploy,
      isLegacyProject(projectConfig?.platformVersion),
      forceOption
    );

    if (!deployResult) {
      return exit(EXIT_CODES.ERROR);
    } else {
      addJsonOutput({ deployId: deployResult.deployId });
    }

    if (deployResult.status === PROJECT_DEPLOY_TEXT.STATES.SUCCESS) {
      deploySuccess = true;
    }
  } catch (e) {
    if (isSpecifiedError(e, { statusCode: 404 })) {
      uiLogger.error(
        commands.project.deploy.errors.projectNotFound(
          targetAccountId,
          projectName
        )
      );
    } else if (isSpecifiedError(e, { statusCode: 400 })) {
      if (e.data?.message && e.data?.errors) {
        logDeployErrors(e.data);
      } else {
        uiLogger.error(e.message);
      }
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: targetAccountId,
          request: 'project deploy',
        })
      );
    }
    return exit(EXIT_CODES.ERROR);
  }

  if (deploySuccess) {
    return exit(EXIT_CODES.SUCCESS);
  } else {
    return exit(EXIT_CODES.ERROR);
  }
}

function projectDeployBuilder(yargs: Argv): Argv<ProjectDeployArgs> {
  yargs.options({
    project: {
      describe: commands.project.deploy.options.project,
      type: 'string',
    },
    build: {
      alias: ['build-id'],
      describe: commands.project.deploy.options.build,
      type: 'number',
    },
    deployLatestBuild: {
      alias: ['deploy-latest-build'],
      describe: commands.project.deploy.options.deployLatestBuild,
      default: false,
      type: 'boolean',
    },
    profile: {
      alias: ['p'],
      describe: commands.project.deploy.options.profile,
      type: 'string',
    },
    force: {
      alias: ['f'],
      describe: commands.project.deploy.options.force,
      default: false,
      type: 'boolean',
    },
  });

  yargs.conflicts('profile', 'project');
  yargs.conflicts('profile', 'account');

  yargs.example([
    ['$0 project deploy', commands.project.deploy.examples.default],
    [
      '$0 project deploy --project="my-project" --build=5',
      commands.project.deploy.examples.withOptions,
    ],
    [
      '$0 project deploy --profile=profileName',
      commands.project.deploy.examples.withProfile,
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
    useJSONOutputOptions: true,
  }
);

const projectDeployCommand: YargsCommandModule<unknown, ProjectDeployArgs> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('project-deploy', handler, {
    jsonOutputSchema: DeploySchema,
  }),
};

export default projectDeployCommand;
