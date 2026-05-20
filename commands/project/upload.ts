import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { uiLogger } from '../../lib/ui/logger.js';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
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
import { ProjectPollResult } from '../../types/Projects.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { projectProfilePrompt } from '../../lib/prompts/projectProfilePrompt.js';

const command = 'upload';
const describe = commands.project.upload.describe;

export type ProjectUploadArgs = CommonArgs &
  JSONOutputArgs & {
    forceCreate: boolean;
    message: string;
    m: string;
    skipValidation: boolean;
    skipNpmAudit: boolean;
    profile?: string;
    preview: boolean;
    target?: number;
  };

type PreviewJsonOutput = { releaseTag?: string; succeeded: boolean };

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
    forceCreate,
    message,
    derivedAccountId,
    skipValidation,
    skipNpmAudit,
    formatOutputAsJson,
    profile: profileOption,
    useEnv: useEnvOption,
    preview,
    target: targetPortalId,
    exit,
    addUsageMetadata,
  } = args;
  const jsonOutput: {
    buildId?: number;
    deployId?: number;
    preview?: { releaseTag?: string; succeeded: boolean };
  } = {};

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
    const { result, uploadError, projectId } =
      await handleProjectUpload<ProjectPollResult>({
        accountId: targetAccountId!,
        projectConfig,
        projectDir,
        callbackFunc: preview
          ? (...args) =>
              pollProjectBuildAndDeploy(...args, { skipDeploy: true })
          : pollProjectBuildAndDeploy,
        uploadMessage: message,
        forceCreate,
        isUploadCommand: true,
        sendIR: !isLegacyProject(projectConfig.platformVersion),
        skipValidation,
        skipNpmAudit,
        profile: profileName,
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
      return exit(EXIT_CODES.ERROR);
    }
    if (
      result &&
      result.succeeded &&
      (!result.buildResult.isAutoDeployEnabled || preview)
    ) {
      uiLogger.log(
        chalk.bold(commands.project.upload.logs.buildSucceeded(result.buildId))
      );

      if (!preview) {
        uiLogger.log(
          commands.project.upload.logs.autoDeployDisabled(
            `hs project deploy --build=${result.buildId}`
          )
        );
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

      if (previewJson && formatOutputAsJson) {
        jsonOutput.preview = previewJson;
      }
    }

    if (result && result.succeeded && formatOutputAsJson) {
      jsonOutput.buildId = result.buildId;
      if (result.deployResult) {
        jsonOutput.deployId = result.deployResult.deployId;
      }
    }

    if (result && !result.succeeded) {
      if (formatOutputAsJson) {
        uiLogger.json(jsonOutput);
      }
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

  if (formatOutputAsJson) {
    uiLogger.json(jsonOutput);
  }

  return exit(EXIT_CODES.SUCCESS);
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
    'skip-npm-audit': {
      describe: commands.project.upload.options.skipNpmAudit.describe,
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
  handler: makeWrappedYargsHandler('project-upload', handler),
  builder,
};

export default projectUploadCommand;
