import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { uiLogger } from '../../lib/ui/logger.js';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import {
  isLegacyProject,
  meetsMinimumPlatformVersion,
} from '@hubspot/project-parsing-lib/projects';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { logFeedbackMessage } from '../../lib/projects/ui.js';
import { handleProjectUpload } from '../../lib/projects/upload.js';
import { loadAndValidateProfile } from '../../lib/projects/projectProfiles.js';
import {
  displayWarnLogs,
  pollProjectBuildAndDeploy,
} from '../../lib/projects/pollProjectBuildAndDeploy.js';
import { triggerAndPollPreview } from '../../lib/projects/preview.js';
import { commands, lib } from '../../lang/en.js';
import { PROJECT_ERROR_TYPES } from '../../lib/constants.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import {
  PreviewJsonOutput,
  UploadJsonOutput,
  UploadSchema,
} from '../../lib/jsonOutput.js';
import { ProjectPollResult } from '../../types/Projects.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { projectProfilePrompt } from '../../lib/prompts/projectProfilePrompt.js';
import { uiDeprecatedTag } from '../../lib/ui/index.js';
import { showMcpPromotionNudge } from '../../lib/mcp/promotion.js';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';

const command = 'upload';
const describe = commands.project.upload.describe;

export type ProjectUploadArgs = CommonArgs &
  JSONOutputArgs<UploadJsonOutput> & {
    force: boolean;
    forceCreate: boolean;
    message: string;
    m: string;
    skipValidation: boolean;
    skipNpmAudit: boolean;
    skipAutoDeploy: boolean;
    profile?: string;
    preview: boolean;
    target?: number;
  };

async function handlePreview(
  accountId: number,
  projectId: number | undefined,
  buildId: number,
  targetPortalId: number
): Promise<PreviewJsonOutput | undefined> {
  if (!projectId) {
    uiLogger.warn(lib.projectPreview.missingProjectId);
    return;
  }

  const previewResult = await triggerAndPollPreview(
    accountId,
    projectId,
    buildId,
    targetPortalId
  );

  if (!previewResult.succeeded) {
    uiLogger.warn(lib.projectPreview.warning);
  }

  return {
    releaseTag: previewResult.releaseTag,
    succeeded: previewResult.succeeded,
  };
}

async function handler(
  args: ArgumentsCamelCase<ProjectUploadArgs>
): Promise<void> {
  const {
    force = false,
    forceCreate = false,
    message,
    derivedAccountId,
    skipValidation,
    skipNpmAudit,
    skipAutoDeploy,
    formatOutputAsJson,
    profile: profileOption,
    useEnv: useEnvOption,
    preview,
    target: targetPortalId,
    exit,
    addUsageMetadata,
    addJsonOutput,
  } = args;

  if (forceCreate) {
    uiDeprecatedTag(commands.project.upload.logs.forceCreateDeprecated);
  }

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  if (!projectDir) {
    uiLogger.error(commands.project.upload.errors.noProjectConfig);
    return exit(EXIT_CODES.ERROR);
  }

  let targetAccountId;
  let profileName = args.profile;

  if (!isLegacyProject(projectConfig?.platformVersion)) {
    try {
      const profileNamePromptResult = await projectProfilePrompt(
        projectDir,
        projectConfig,
        profileOption,
        !!useEnvOption
      );

      if (profileNamePromptResult) {
        profileName = profileNamePromptResult;

        const profile = await loadAndValidateProfile(
          projectConfig,
          projectDir,
          profileName
        );
        targetAccountId = profile.accountId;
      }
    } catch (error) {
      logError(error);
      return exit(EXIT_CODES.ERROR);
    }
  }

  targetAccountId = targetAccountId || derivedAccountId;

  const accountConfig = getConfigAccountById(targetAccountId!);
  const accountType = accountConfig && accountConfig.accountType;

  addUsageMetadata({
    type: accountType!,
    assetType: projectConfig.platformVersion,
  });

  try {
    const { result, uploadError, projectId, userDeclined } =
      await handleProjectUpload<ProjectPollResult>({
        accountId: targetAccountId!,
        projectConfig,
        projectDir,
        callbackFunc:
          preview || skipAutoDeploy
            ? (...args) =>
                pollProjectBuildAndDeploy(...args, { skipDeploy: true })
            : pollProjectBuildAndDeploy,
        uploadMessage: message,
        forceCreate: forceCreate || force,
        isUploadCommand: true,
        sendIR: !isLegacyProject(projectConfig.platformVersion),
        skipValidation,
        skipNpmAudit,
        skipAutoDeploy,
        profile: profileName,
        force,
      });

    if (userDeclined) {
      return exit(EXIT_CODES.SUCCESS);
    }

    if (uploadError) {
      if (
        isSpecifiedError(uploadError, {
          subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
        })
      ) {
        uiLogger.log('');
        uiLogger.error(commands.project.upload.errors.projectLockedError);
        uiLogger.log('');
      } else {
        logError(
          uploadError,
          new ApiErrorContext({
            accountId: targetAccountId,
            request: 'project upload',
          })
        );
      }
      return exit(EXIT_CODES.ERROR);
    }
    if (
      result &&
      result.succeeded &&
      (!result.buildResult.isAutoDeployEnabled || preview || skipAutoDeploy)
    ) {
      uiLogger.log(
        chalk.bold(commands.project.upload.logs.buildSucceeded(result.buildId))
      );

      if (!preview) {
        if (
          meetsMinimumPlatformVersion(
            result.buildResult.platformVersion,
            PLATFORM_VERSIONS.v2027_03_BETA
          )
        ) {
          const releaseCommand = `hs project release create --build=${result.buildId}`;
          uiLogger.log(
            commands.project.upload.logs.releaseManagementRequired(
              releaseCommand
            )
          );
        } else {
          const deployCommand = `hs project deploy --build=${result.buildId}`;
          uiLogger.log(
            skipAutoDeploy
              ? commands.project.upload.logs.autoDeploySkipped(deployCommand)
              : commands.project.upload.logs.autoDeployDisabled(deployCommand)
          );
        }
        logFeedbackMessage(result.buildId);
      }

      await displayWarnLogs(
        targetAccountId!,
        projectConfig.name,
        result.buildId
      );
    }

    if (result && result.succeeded && preview && targetPortalId) {
      const previewJson = await handlePreview(
        targetAccountId!,
        projectId,
        result.buildId,
        targetPortalId
      );

      if (previewJson) {
        addJsonOutput({ preview: previewJson });
      }
    }

    if (result) {
      addJsonOutput({ buildId: result.buildId });
      if (result.deployResult) {
        addJsonOutput({ deployId: result.deployResult.deployId });
      }
    }

    if (result && !result.succeeded) {
      return exit(EXIT_CODES.ERROR);
    }

    if (!result && !uploadError) {
      return exit(EXIT_CODES.ERROR);
    }
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({
        accountId: targetAccountId,
        request: 'project upload',
      })
    );
    return exit(EXIT_CODES.ERROR);
  }

  if (!formatOutputAsJson) {
    await showMcpPromotionNudge(args._.join(' '));
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectUploadBuilder(yargs: Argv): Argv<ProjectUploadArgs> {
  yargs.options({
    force: {
      alias: 'f',
      describe: commands.project.upload.options.force.describe,
      type: 'boolean',
      default: false,
    },
    'force-create': {
      describe: commands.project.upload.options.forceCreate.describe,
      type: 'boolean',
      default: false,
      hidden: true,
    },
    message: {
      alias: 'm',
      describe: commands.project.upload.options.message.describe,
      type: 'string',
      default: '',
    },
    'skip-validation': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
    'skip-npm-audit': {
      describe: commands.project.upload.options.skipNpmAudit.describe,
      type: 'boolean',
      default: false,
    },
    'skip-auto-deploy': {
      describe: commands.project.upload.options.skipAutoDeploy.describe,
      type: 'boolean',
      default: false,
    },
    profile: {
      type: 'string',
      alias: 'p',
      describe: commands.project.upload.options.profile.describe,
    },
    preview: {
      describe: commands.project.upload.options.preview.describe,
      type: 'boolean',
      default: false,
      hidden: true,
    },
    target: {
      describe: commands.project.upload.options.target.describe,
      type: 'number',
      requiresArg: true,
      hidden: true,
    },
  });

  yargs.check(argv => {
    if (argv.preview && argv.target == null) {
      throw new Error(commands.project.upload.errors.previewRequiresTarget);
    }
    if (argv.target != null && !argv.preview) {
      throw new Error(commands.project.upload.errors.targetRequiresPreview);
    }
    return true;
  });

  yargs.conflicts('profile', 'account');
  yargs.example([
    ['$0 project upload', commands.project.upload.examples.default],
    [
      '$0 project upload --profile=profileName',
      commands.project.upload.examples.withProfile,
    ],
    // TODO: Unhide when 2026.09 ships
    // [
    //   '$0 project upload --preview --target=12345',
    //   commands.project.upload.examples.withPreview,
    // ],
  ]);

  return yargs as Argv<ProjectUploadArgs>;
}

const builder = makeYargsBuilder<ProjectUploadArgs>(
  projectUploadBuilder,
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

const projectUploadCommand: YargsCommandModule<unknown, ProjectUploadArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('project-upload', handler, {
    jsonOutputSchema: UploadSchema,
  }),
  builder,
};

export default projectUploadCommand;
