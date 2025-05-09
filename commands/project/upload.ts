import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import path from 'path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import {
  getAllHsProfiles,
  getHsProfileFilename,
} from '@hubspot/project-parsing-lib';
import { useV3Api } from '../../lib/projects/buildAndDeploy';
import {
  uiBetaTag,
  uiCommandReference,
  uiLine,
  uiAccountDescription,
} from '../../lib/ui';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config';
import { logFeedbackMessage } from '../../lib/projects/ui';
import { handleProjectUpload } from '../../lib/projects/upload';
import {
  displayWarnLogs,
  pollProjectBuildAndDeploy,
} from '../../lib/projects/buildAndDeploy';
import { i18n } from '../../lib/lang';
import { PROJECT_ERROR_TYPES } from '../../lib/constants';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs';
import { ProjectPollResult } from '../../types/Projects';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { loadProfile } from '../../lib/projectProfiles';

const command = 'upload';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.upload.describe`),
  false
);

type ProjectUploadArgs = CommonArgs & {
  forceCreate: boolean;
  message: string;
  m: string;
  skipValidation: boolean;
  profile?: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectUploadArgs>
): Promise<void> {
  const { forceCreate, message, derivedAccountId, skipValidation } = args;

  const { projectConfig, projectDir } = await getProjectConfig();
  validateProjectConfig(projectConfig, projectDir);

  let targetAccountId;

  if (useV3Api(projectConfig.platformVersion)) {
    if (args.profile) {
      uiLine();
      uiBetaTag(
        i18n('commands.project.subcommands.upload.logs.usingProfile', {
          profileFilename: getHsProfileFilename(args.profile),
        })
      );
      logger.log('');

      const profile = await loadProfile(
        projectConfig,
        projectDir,
        args.profile
      );

      if (!profile) {
        logger.log('');
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }

      targetAccountId = profile.accountId;

      logger.log(
        i18n('commands.project.subcommands.upload.logs.profileTargetAccount', {
          account: uiAccountDescription(targetAccountId),
        })
      );

      if (profile.variables) {
        logger.log('');
        logger.log(
          i18n('commands.project.subcommands.upload.logs.profileVariables')
        );
        Object.entries(profile.variables ?? {}).forEach(([key, value]) => {
          logger.log(`  ${key}: ${value}`);
        });
      }
    }
    uiLine();
    logger.log('');
  } else {
    // Check if the project has any project profiles configured
    const existingProfiles = await getAllHsProfiles(
      path.join(projectDir!, projectConfig.srcDir)
    );

    if (existingProfiles.length > 0) {
      logger.error(
        i18n('commands.project.subcommands.upload.errors.noProfileSpecified')
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (!targetAccountId) {
    // The user is not using profiles, so we can use the derived accountId
    targetAccountId = derivedAccountId;
  }

  const accountConfig = getAccountConfig(targetAccountId!);
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-upload', { type: accountType! }, targetAccountId);

  try {
    const { result, uploadError } =
      await handleProjectUpload<ProjectPollResult>({
        accountId: targetAccountId!,
        projectConfig,
        projectDir: projectDir!,
        callbackFunc: pollProjectBuildAndDeploy,
        uploadMessage: message,
        forceCreate,
        isUploadCommand: true,
        sendIR: useV3Api(projectConfig.platformVersion),
        skipValidation,
        profile: args.profile,
      });

    if (uploadError) {
      if (
        isSpecifiedError(uploadError, {
          subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
        })
      ) {
        logger.log();
        logger.error(
          i18n(`commands.project.subcommands.upload.errors.projectLockedError`)
        );
        logger.log();
      } else {
        logError(
          uploadError,
          new ApiErrorContext({
            accountId: targetAccountId,
            request: 'project upload',
          })
        );
      }
      process.exit(EXIT_CODES.ERROR);
    }
    if (result && result.succeeded && !result.buildResult.isAutoDeployEnabled) {
      logger.log(
        chalk.bold(
          i18n(`commands.project.subcommands.upload.logs.buildSucceeded`, {
            buildId: result.buildId,
          })
        )
      );
      logger.log(
        i18n(`commands.project.subcommands.upload.logs.autoDeployDisabled`, {
          deployCommand: uiCommandReference(
            `hs project deploy --build=${result.buildId}`
          ),
        })
      );
      logFeedbackMessage(result.buildId);

      await displayWarnLogs(
        targetAccountId!,
        projectConfig.name,
        result.buildId
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({
        accountId: targetAccountId,
        request: 'project upload',
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function projectUploadBuilder(yargs: Argv): Argv<ProjectUploadArgs> {
  yargs.options({
    'force-create': {
      describe: i18n(
        `commands.project.subcommands.upload.options.forceCreate.describe`
      ),
      type: 'boolean',
      default: false,
    },
    message: {
      alias: 'm',
      describe: i18n(
        `commands.project.subcommands.upload.options.message.describe`
      ),
      type: 'string',
      default: '',
    },
    'skip-validation': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
    profile: {
      type: 'string',
      alias: 'p',
      describe: i18n(
        `commands.project.subcommands.upload.options.profile.describe`
      ),
      hidden: true,
    },
  });

  yargs.conflicts('profile', 'account');

  yargs.example([
    [
      '$0 project upload',
      i18n(`commands.project.subcommands.upload.examples.default`),
    ],
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
  }
);

const projectUploadCommand: YargsCommandModule<unknown, ProjectUploadArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectUploadCommand;
