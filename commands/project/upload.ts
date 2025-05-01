import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { useV3Api } from '../../lib/projects/buildAndDeploy';
import { uiBetaTag, uiCommandReference } from '../../lib/ui';
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
  env?: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectUploadArgs>
): Promise<void> {
  const { forceCreate, message, derivedAccountId, skipValidation } = args;
  const accountConfig = getAccountConfig(derivedAccountId);
  const accountType = accountConfig && accountConfig.accountType;

  const { projectConfig, projectDir } = await getProjectConfig();

  trackCommandUsage('project-upload', { type: accountType! }, derivedAccountId);

  validateProjectConfig(projectConfig, projectDir);

  try {
    const { result, uploadError } =
      await handleProjectUpload<ProjectPollResult>({
        accountId: derivedAccountId,
        projectConfig,
        projectDir: projectDir!,
        callbackFunc: pollProjectBuildAndDeploy,
        uploadMessage: message,
        forceCreate,
        isUploadCommand: true,
        sendIR: useV3Api(projectConfig.platformVersion),
        skipValidation,
        env: args.env,
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
            accountId: derivedAccountId,
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
        derivedAccountId,
        projectConfig.name,
        result.buildId
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({
        accountId: derivedAccountId,
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
    env: {
      type: 'string',
      describe: i18n(
        `commands.project.subcommands.upload.options.env.describe`
      ),
      hidden: true,
    },
  });

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
