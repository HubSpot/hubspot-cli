import { ArgumentsCamelCase, Argv } from 'yargs';
import path from 'path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lib/lang';
import { checkAndWarnGitInclusion } from '../lib/ui/git';
import {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import { AccessToken, CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import {
  updateAccountConfig,
  writeConfig,
  getConfigPath,
  loadConfig,
  getConfigDefaultAccount,
  getAccountId,
  configFileExists,
} from '@hubspot/local-dev-lib/config';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import { promptUser } from '../lib/prompts/promptUtils';
import {
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  OauthPromptResponse,
  PersonalAccessKeyPromptResponse,
} from '../lib/prompts/personalAccessKeyPrompt';
import { cliAccountNamePrompt } from '../lib/prompts/accountNamePrompt';
import { setAsDefaultAccountPrompt } from '../lib/prompts/setAsDefaultAccountPrompt';
import { createProjectPrompt } from '../lib/prompts/createProjectPrompt';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { setLogLevel } from '../lib/commonOpts';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { trackAuthAction, trackCommandUsage } from '../lib/usageTracking';
import { authenticateWithOauth } from '../lib/oauth';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { uiBetaTag, uiCommandReference, uiLink } from '../lib/ui';
import { logError, ApiErrorContext } from '../lib/errorHandlers/index';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  TestingArgs,
} from '../types/Yargs';
import fs from 'fs-extra';
import {
  fetchReleaseData,
  cloneGithubRepo,
} from '@hubspot/local-dev-lib/github';
import {
  writeProjectConfig,
  getProjectConfig,
  validateProjectConfig,
} from '../lib/projects/config';
import {
  getProjectTemplateListFromRepo,
  EMPTY_PROJECT_TEMPLATE_NAME,
} from '../lib/projects/create';
import {
  PROJECT_CONFIG_FILE,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} from '../lib/constants';
import { handleProjectUpload } from '../lib/projects/upload';
import {
  displayWarnLogs,
  pollProjectBuildAndDeploy,
  useV3Api,
} from '../lib/projects/buildAndDeploy';
import { logFeedbackMessage } from '../lib/projects/ui';
import { ProjectConfig } from '../types/Projects';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { PROJECT_ERROR_TYPES } from '../lib/constants';
import { ProjectPollResult } from '../types/Projects';
import { unifiedProjectDevFlow } from './project/dev/unifiedFlow';
import { deprecatedProjectDevFlow } from './project/dev/deprecatedFlow';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

export const command = 'get-started';
export const describe =
  'Complete setup by authenticating, creating, uploading, and running a project';

type GetStartedArgs = CommonArgs &
  ConfigArgs &
  TestingArgs &
  AccountArgs &
  EnvironmentArgs & {
    authType?: string;
    name?: string;
    dest?: string;
    templateSource?: string;
    template?: string;
  };

export async function handler(
  args: ArgumentsCamelCase<GetStartedArgs>
): Promise<void> {
  const {
    authType: authTypeFlagValue,
    config: configFlagValue,
    qa,
    providedAccountId,
    derivedAccountId,
  } = args;
  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(args);

  // Track command usage
  trackCommandUsage('get-started');

  // Step 1: Authentication
  logger.log('');
  logger.log('Step 1: Authentication');

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  // Needed to load deprecated config
  loadConfig(configFlagValue!);
  const configPath = getConfigPath();
  if (configPath) {
    checkAndWarnGitInclusion(configPath);
  }

  if (configFileExists(true)) {
    const globalConfigPath = getConfigPath('', true);
    logger.error(
      i18n(`commands.auth.errors.globalConfigFileExists`, {
        configPath: globalConfigPath!,
        authCommand: uiCommandReference('hs account auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  trackAuthAction('auth', authType, TRACKING_STATUS.STARTED, providedAccountId);

  let configData:
    | OauthPromptResponse
    | PersonalAccessKeyPromptResponse
    | undefined;
  let updatedConfig: CLIAccount | null | undefined;
  let validName: string | undefined;
  let successAuthMethod: string | undefined;
  let token: AccessToken | undefined;
  let defaultName: string | undefined;

  switch (authType) {
    case OAUTH_AUTH_METHOD.value:
      configData = await promptUser<OauthPromptResponse>(OAUTH_FLOW);
      await authenticateWithOauth({
        ...configData,
        env,
      });
      successAuthMethod = OAUTH_AUTH_METHOD.name;
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      configData = await personalAccessKeyPrompt({
        env,
        account: providedAccountId,
      });

      try {
        token = await getAccessToken(configData.personalAccessKey, env);
        defaultName = toKebabCase(token.hubName);

        updatedConfig = await updateConfigWithAccessToken(
          token,
          configData.personalAccessKey,
          env
        );
      } catch (e) {
        logError(e);
      }

      if (!updatedConfig) {
        break;
      }

      validName = updatedConfig.name;

      if (!validName) {
        const { name: namePrompt } = await cliAccountNamePrompt(defaultName);
        validName = namePrompt;
      }

      updateAccountConfig({
        ...updatedConfig,
        env: updatedConfig.env,
        tokenInfo: updatedConfig.auth!.tokenInfo,
        name: validName,
      });
      writeConfig();

      successAuthMethod = PERSONAL_ACCESS_KEY_AUTH_METHOD.name;
      break;
    default:
      logger.error(
        i18n('commands.auth.errors.unsupportedAuthType', {
          supportedProtocols: '',
          type: authType,
        })
      );
      break;
  }

  if (!successAuthMethod) {
    await trackAuthAction(
      'auth',
      authType,
      TRACKING_STATUS.ERROR,
      providedAccountId
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const nameFromConfigData =
    'name' in configData! ? configData!.name : undefined;

  const accountName =
    (updatedConfig && updatedConfig.name) || validName || nameFromConfigData!;

  const setAsDefault = await setAsDefaultAccountPrompt(accountName);

  logger.log('');
  if (setAsDefault) {
    logger.success(
      i18n('lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount', {
        accountName,
      })
    );
  } else {
    logger.info(
      i18n('lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault', {
        accountName: getConfigDefaultAccount()!,
      })
    );
  }
  logger.success(
    i18n('commands.auth.success.configFileUpdated', {
      configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      authType: successAuthMethod,
      accountName,
    })
  );

  const effectiveAccountId = getAccountId(accountName) || undefined;
  await trackAuthAction(
    'auth',
    authType,
    TRACKING_STATUS.COMPLETE,
    effectiveAccountId
  );

  // Step 2: Create Project
  logger.log('');
  logger.log('Step 2: Creating a new project');

  let latestRepoReleaseTag: string | undefined;
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
      logger.error(
        i18n(
          `commands.project.subcommands.create.error.failedToFetchProjectList`
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (!templateSource || !templateSource.includes('/')) {
    logger.error(
      i18n(`commands.project.subcommands.create.error.invalidTemplateSource`)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const projectTemplates = await getProjectTemplateListFromRepo(
    templateSource,
    latestRepoReleaseTag || DEFAULT_PROJECT_TEMPLATE_BRANCH
  );

  if (!projectTemplates.length) {
    logger.error(
      i18n(`commands.project.subcommands.create.error.failedToFetchProjectList`)
    );
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
      i18n(`commands.project.subcommands.create.errors.cannotNestProjects`, {
        projectDir: existingProjectDir,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await cloneGithubRepo(templateSource, projectDest, {
      sourceDir: createProjectPromptResponse.projectTemplate.path,
      tag: latestRepoReleaseTag,
      hideLogs: true,
    });
  } catch (err) {
    logError(err);
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
    i18n(`commands.project.subcommands.create.logs.success`, {
      projectName: createProjectPromptResponse.name,
      projectDest,
    })
  );

  // Step 3: Upload Project
  logger.log('');
  logger.log('Step 3: Uploading your project to HubSpot');

  // First, change into the project directory
  process.chdir(projectDest);

  const { projectConfig, projectDir } = await getProjectConfig();
  const accountConfig = getAccountConfig(derivedAccountId);
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-upload', { type: accountType! }, derivedAccountId);

  validateProjectConfig(projectConfig, projectDir);

  try {
    const { result, uploadError } =
      await handleProjectUpload<ProjectPollResult>({
        accountId: derivedAccountId,
        projectConfig,
        projectDir: projectDir!,
        callbackFunc: pollProjectBuildAndDeploy,
        uploadMessage: '',
        forceCreate: false,
        isUploadCommand: true,
        sendIR: useV3Api(projectConfig.platformVersion),
        skipValidation: false,
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
        i18n(`commands.project.subcommands.upload.logs.buildSucceeded`, {
          buildId: result.buildId,
        })
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

  // Step 4: Start Dev Server
  logger.log('');
  logger.log('Step 4: Starting local development server');

  trackCommandUsage('project-dev', {}, derivedAccountId);

  if (!accountConfig) {
    logger.error(i18n(`commands.project.subcommands.dev.errors.noAccount`));
    process.exit(EXIT_CODES.ERROR);
  }

  uiBetaTag(i18n(`commands.project.subcommands.dev.logs.betaMessage`));

  logger.log(
    uiLink(
      i18n(`commands.project.subcommands.dev.logs.learnMoreLocalDevServer`),
      'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
    )
  );

  validateProjectConfig(projectConfig, projectDir);

  if (useV3Api(projectConfig.platformVersion)) {
    await unifiedProjectDevFlow(
      args,
      accountConfig,
      projectConfig,
      projectDir!
    );
  } else {
    await deprecatedProjectDevFlow(
      args,
      accountConfig,
      projectConfig,
      projectDir!
    );
  }
}

function getStartedBuilder(yargs: Argv): Argv<GetStartedArgs> {
  yargs.options({
    'auth-type': {
      describe: i18n('commands.auth.options.authType.describe'),
      type: 'string',
      choices: [
        `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
        `${OAUTH_AUTH_METHOD.value}`,
      ],
      default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    },
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
  });

  yargs.example([
    ['$0 get-started', 'Complete the setup process for a new HubSpot project'],
  ]);

  return yargs as Argv<GetStartedArgs>;
}

export const builder = makeYargsBuilder<GetStartedArgs>(
  getStartedBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: true,
  }
);
