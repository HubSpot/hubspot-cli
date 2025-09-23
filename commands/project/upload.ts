import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { uiLogger } from '../../lib/ui/logger.js';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { isV2Project } from '../../lib/projects/platformVersion.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { logFeedbackMessage } from '../../lib/projects/ui.js';
import { handleProjectUpload } from '../../lib/projects/upload.js';
import { loadAndValidateProfile } from '../../lib/projectProfiles.js';
import {
  displayWarnLogs,
  pollProjectBuildAndDeploy,
} from '../../lib/projects/pollProjectBuildAndDeploy.js';
import { commands } from '../../lang/en.js';
import { PROJECT_ERROR_TYPES } from '../../lib/constants.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { ProjectPollResult } from '../../types/Projects.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'upload';
const describe = commands.project.upload.describe;

type ProjectUploadArgs = CommonArgs &
  JSONOutputArgs & {
    forceCreate: boolean;
    message: string;
    m: string;
    skipValidation: boolean;
    profile?: string;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectUploadArgs>
): Promise<void> {
  const {
    forceCreate,
    message,
    derivedAccountId,
    skipValidation,
    formatOutputAsJson,
    profile,
  } = args;
  const jsonOutput: { buildId?: number; deployId?: number } = {};

  const { projectConfig, projectDir } = await getProjectConfig();
  validateProjectConfig(projectConfig, projectDir);

  let targetAccountId;

  if (isV2Project(projectConfig.platformVersion)) {
    targetAccountId = await loadAndValidateProfile(
      projectConfig,
      projectDir,
      profile
    );
  }

  targetAccountId = targetAccountId || derivedAccountId;

  const accountConfig = getAccountConfig(targetAccountId!);
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage(
    'project-upload',
    { type: accountType!, assetType: projectConfig.platformVersion },
    targetAccountId
  );

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
        sendIR: isV2Project(projectConfig.platformVersion),
        skipValidation,
        profile: args.profile,
      });

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
      process.exit(EXIT_CODES.ERROR);
    }
    if (result && result.succeeded && !result.buildResult.isAutoDeployEnabled) {
      uiLogger.log(
        chalk.bold(commands.project.upload.logs.buildSucceeded(result.buildId))
      );
      uiLogger.log(
        commands.project.upload.logs.autoDeployDisabled(
          `hs project deploy --build=${result.buildId}`
        )
      );
      logFeedbackMessage(result.buildId);

      await displayWarnLogs(
        targetAccountId!,
        projectConfig.name,
        result.buildId
      );
    }

    if (result && result.succeeded && formatOutputAsJson) {
      jsonOutput.buildId = result.buildId;
      if (result.deployResult) {
        jsonOutput.deployId = result.deployResult.deployId;
      }
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

  if (formatOutputAsJson) {
    uiLogger.json(jsonOutput);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function projectUploadBuilder(yargs: Argv): Argv<ProjectUploadArgs> {
  yargs.options({
    'force-create': {
      describe: commands.project.upload.options.forceCreate.describe,
      type: 'boolean',
      default: false,
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
    profile: {
      type: 'string',
      alias: 'p',
      describe: commands.project.upload.options.profile.describe,
      hidden: true,
    },
  });

  yargs.conflicts('profile', 'account');

  yargs.example([
    ['$0 project upload', commands.project.upload.examples.default],
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
  handler,
  builder,
};

export default projectUploadCommand;
