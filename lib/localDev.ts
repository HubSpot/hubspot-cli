import { logger } from '@hubspot/local-dev-lib/logger';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getAccountConfig, getEnv } from '@hubspot/local-dev-lib/config';
import { createProject } from '@hubspot/local-dev-lib/api/projects';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { DeveloperTestAccount } from '@hubspot/local-dev-lib/types/developerTestAccounts';
import { Project } from '@hubspot/local-dev-lib/types/Project';

import {
  confirmDefaultAccountPrompt,
  selectSandboxTargetAccountPrompt,
  selectDeveloperTestTargetAccountPrompt,
  confirmUseExistingDeveloperTestAccountPrompt,
} from './prompts/projectDevTargetAccountPrompt';
import { confirmPrompt } from './prompts/promptUtils';
import { validateSandboxUsageLimits, getAvailableSyncTypes } from './sandboxes';
import { syncSandbox } from './sandboxSync';
import { validateDevTestAccountUsageLimits } from './developerTestAccounts';
import { uiCommandReference, uiLine, uiAccountDescription } from './ui';
import SpinniesManager from './ui/SpinniesManager';
import { i18n } from './lang';
import { EXIT_CODES } from './enums/exitCodes';
import { trackCommandMetadataUsage } from './usageTracking';
import { isAppDeveloperAccount, isDeveloperTestAccount } from './accountTypes';
import { handleProjectUpload } from './projects/upload';
import { pollProjectBuildAndDeploy } from './projects/buildAndDeploy';
import {
  PROJECT_ERROR_TYPES,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
} from './constants';
import { logError, ApiErrorContext } from './errorHandlers/index';
import {
  buildSandbox,
  buildDeveloperTestAccount,
  saveAccountToConfig,
} from './buildAccount';
import { hubspotAccountNamePrompt } from './prompts/accountNamePrompt';
import {
  ProjectConfig,
  ProjectPollResult,
  ProjectSubtask,
} from '../types/Projects';
import { ProjectDevTargetAccountPromptResponse } from '../types/Prompts';
import { FileResult } from 'tmp';
import { Build } from '@hubspot/local-dev-lib/types/Build';

const i18nKey = 'lib.localDev';

// If the user passed in the --account flag, confirm they want to use that account as
// their target account, otherwise exit
export async function confirmDefaultAccountIsTarget(
  accountConfig: CLIAccount
): Promise<void> {
  if (!accountConfig.name || !accountConfig.accountType) {
    logger.error(
      i18n(`${i18nKey}.confirmDefaultAccountIsTarget.configError`, {
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log();
  const useDefaultAccount = await confirmDefaultAccountPrompt(
    accountConfig.name,
    HUBSPOT_ACCOUNT_TYPE_STRINGS[accountConfig.accountType]
  );

  if (!useDefaultAccount) {
    logger.log(
      i18n(
        `${i18nKey}.confirmDefaultAccountIsTarget.declineDefaultAccountExplanation`,
        {
          useCommand: uiCommandReference('hs accounts use'),
          devCommand: uiCommandReference('hs project dev'),
        }
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// Confirm the default account is supported for the type of apps being developed
export function checkIfDefaultAccountIsSupported(
  accountConfig: CLIAccount,
  hasPublicApps: boolean
): void {
  if (
    hasPublicApps &&
    !(
      isAppDeveloperAccount(accountConfig) ||
      isDeveloperTestAccount(accountConfig)
    )
  ) {
    logger.error(
      i18n(`${i18nKey}.checkIfDefaultAccountIsSupported.publicApp`, {
        useCommand: uiCommandReference('hs accounts use'),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } else if (!hasPublicApps && isAppDeveloperAccount(accountConfig)) {
    logger.error(
      i18n(`${i18nKey}.checkIfDefaultAccountIsSupported.privateApp`, {
        useCommand: uiCommandReference('hs accounts use'),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

export function checkIfParentAccountIsAuthed(accountConfig: CLIAccount): void {
  if (
    !accountConfig.parentAccountId ||
    !getAccountConfig(accountConfig.parentAccountId)
  ) {
    logger.error(
      i18n(`${i18nKey}.checkIfParentAccountIsAuthed.notAuthedError`, {
        accountId: accountConfig.parentAccountId || '',
        accountIdentifier: uiAccountDescription(
          getAccountIdentifier(accountConfig)
        ),
        authCommand: uiCommandReference(
          `hs auth --account=${accountConfig.parentAccountId}`
        ),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// Confirm the default account is a developer account if developing public apps
export function checkIfAccountFlagIsSupported(
  accountConfig: CLIAccount,
  hasPublicApps: boolean
): void {
  if (hasPublicApps) {
    if (!isDeveloperTestAccount(accountConfig)) {
      logger.error(
        i18n(`${i18nKey}.validateAccountOption.invalidPublicAppAccount`, {
          useCommand: uiCommandReference('hs accounts use'),
          devCommand: uiCommandReference('hs project dev'),
        })
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
    checkIfParentAccountIsAuthed(accountConfig);
  } else if (isAppDeveloperAccount(accountConfig)) {
    logger.error(
      i18n(`${i18nKey}.validateAccountOption.invalidPrivateAppAccount`, {
        useCommand: uiCommandReference('hs accounts use'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// If the user isn't using the recommended account type, prompt them to use or create one
export async function suggestRecommendedNestedAccount(
  accounts: CLIAccount[],
  accountConfig: CLIAccount,
  hasPublicApps: boolean
): Promise<ProjectDevTargetAccountPromptResponse> {
  logger.log();
  uiLine();
  if (hasPublicApps) {
    logger.log(
      i18n(
        `${i18nKey}.validateAccountOption.publicAppNonDeveloperTestAccountWarning`
      )
    );
  } else {
    logger.log(i18n(`${i18nKey}.validateAccountOption.nonSandboxWarning`));
  }
  uiLine();
  logger.log();

  const targetAccountPrompt = isAppDeveloperAccount(accountConfig)
    ? selectDeveloperTestTargetAccountPrompt
    : selectSandboxTargetAccountPrompt;

  return targetAccountPrompt(accounts, accountConfig);
}

// Create a new sandbox and return its accountId
export async function createSandboxForLocalDev(
  accountId: number,
  accountConfig: CLIAccount,
  env: Environment
): Promise<number> {
  try {
    await validateSandboxUsageLimits(
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      env
    );
  } catch (err) {
    if (isMissingScopeError(err)) {
      logger.error(
        i18n('lib.sandbox.create.failure.scopes.message', {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n('lib.sandbox.create.failure.scopes.instructions', {
          accountName: accountConfig.name || accountId,
          url,
        })
      );
    } else {
      logError(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }
  try {
    const { name } = await hubspotAccountNamePrompt({
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    });

    trackCommandMetadataUsage(
      'sandbox-create',
      { step: 'project-dev' },
      accountId
    );

    const result = await buildSandbox(
      name,
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      env
    );

    const targetAccountId = result.sandbox.sandboxHubId;

    const sandboxAccountConfig = getAccountConfig(result.sandbox.sandboxHubId);

    if (!sandboxAccountConfig) {
      logger.error(i18n('lib.sandbox.create.failure.generic'));
      process.exit(EXIT_CODES.ERROR);
    }

    const syncTasks = await getAvailableSyncTypes(
      accountConfig,
      sandboxAccountConfig
    );
    // For v1 sandboxes, keep sync here. Once we migrate to v2, this will be handled by BE automatically
    await syncSandbox(
      sandboxAccountConfig,
      accountConfig,
      env,
      syncTasks,
      true
    );
    return targetAccountId;
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

// Create a developer test account and return its accountId
export async function createDeveloperTestAccountForLocalDev(
  accountId: number,
  accountConfig: CLIAccount,
  env: Environment
): Promise<number> {
  let currentPortalCount = 0;
  let maxTestPortals = 10;
  try {
    const validateResult =
      await validateDevTestAccountUsageLimits(accountConfig);
    if (validateResult) {
      currentPortalCount = validateResult.results
        ? validateResult.results.length
        : 0;
      maxTestPortals = validateResult.maxTestPortals;
    }
  } catch (err) {
    if (isMissingScopeError(err)) {
      logger.error(
        i18n('lib.developerTestAccount.create.failure.scopes.message', {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n('lib.developerTestAccount.create.failure.scopes.instructions', {
          accountName: accountConfig.name || accountId,
          url,
        })
      );
    } else {
      logError(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    const { name } = await hubspotAccountNamePrompt({
      currentPortalCount,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
    });
    trackCommandMetadataUsage(
      'developer-test-account-create',
      { step: 'project-dev' },
      accountId
    );

    const result = await buildDeveloperTestAccount(
      name,
      accountConfig,
      env,
      maxTestPortals
    );

    return result;
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

// Prompt user to confirm usage of an existing developer test account that is not currently in the config
export async function useExistingDevTestAccount(
  env: Environment,
  account: DeveloperTestAccount
): Promise<void> {
  const useExistingDevTestAcct =
    await confirmUseExistingDeveloperTestAccountPrompt(account);
  if (!useExistingDevTestAcct) {
    logger.log('');
    logger.log(
      i18n(
        `${i18nKey}.confirmDefaultAccountIsTarget.declineDefaultAccountExplanation`,
        {
          useCommand: uiCommandReference('hs accounts use'),
          devCommand: uiCommandReference('hs project dev'),
        }
      )
    );
    logger.log('');
    process.exit(EXIT_CODES.SUCCESS);
  }
  const devTestAcctConfigName = await saveAccountToConfig(
    account.id,
    account.accountName,
    env
  );
  logger.success(
    i18n(`lib.developerTestAccount.create.success.configFileUpdated`, {
      accountName: devTestAcctConfigName,
      authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
    })
  );
}

// Prompt the user to create a new project if one doesn't exist on their target account
export async function createNewProjectForLocalDev(
  projectConfig: ProjectConfig,
  targetAccountId: number,
  shouldCreateWithoutConfirmation: boolean,
  hasPublicApps: boolean
): Promise<Project> {
  // Create the project without prompting if this is a newly created sandbox
  let shouldCreateProject = shouldCreateWithoutConfirmation;

  if (!shouldCreateProject) {
    const explanationString = i18n(
      hasPublicApps
        ? `${i18nKey}.createNewProjectForLocalDev.publicAppProjectMustExistExplanation`
        : `${i18nKey}.createNewProjectForLocalDev.projectMustExistExplanation`,
      {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      }
    );
    logger.log();
    uiLine();
    logger.log(explanationString);
    uiLine();

    shouldCreateProject = await confirmPrompt(
      i18n(`${i18nKey}.createNewProjectForLocalDev.createProject`, {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      })
    );
  }

  if (shouldCreateProject) {
    SpinniesManager.add('createProject', {
      text: i18n(`${i18nKey}.createNewProjectForLocalDev.creatingProject`, {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      }),
    });

    try {
      const { data: project } = await createProject(
        targetAccountId,
        projectConfig.name
      );
      SpinniesManager.succeed('createProject', {
        text: i18n(`${i18nKey}.createNewProjectForLocalDev.createdProject`, {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        }),
        succeedColor: 'white',
      });
      return project;
    } catch (err) {
      SpinniesManager.fail('createProject');
      logger.log(
        i18n(`${i18nKey}.createNewProjectForLocalDev.failedToCreateProject`)
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    // We cannot continue if the project does not exist in the target account
    logger.log();
    logger.log(
      i18n(`${i18nKey}.createNewProjectForLocalDev.choseNotToCreateProject`)
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

function projectUploadCallback(
  accountId: number,
  projectConfig: ProjectConfig,
  tempFile: FileResult,
  buildId?: number
): Promise<ProjectPollResult> {
  if (!buildId) {
    logger.error(
      i18n(`${i18nKey}.createInitialBuildForNewProject.initialUploadMessage`, {
        uploadCommand: uiCommandReference('hs project upload'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  return pollProjectBuildAndDeploy(
    accountId,
    projectConfig,
    tempFile,
    buildId,
    true
  );
}

// Create an initial build if the project was newly created in the account
// Return the newly deployed build
export async function createInitialBuildForNewProject(
  projectConfig: ProjectConfig,
  projectDir: string,
  targetAccountId: number,
  sendIr?: boolean
): Promise<Build> {
  const { result: initialUploadResult, uploadError } =
    await handleProjectUpload<ProjectPollResult>(
      targetAccountId,
      projectConfig,
      projectDir,
      projectUploadCallback,
      i18n(`${i18nKey}.createInitialBuildForNewProject.initialUploadMessage`),
      sendIr
    );

  if (uploadError) {
    if (
      isSpecifiedError(uploadError, {
        subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
      })
    ) {
      logger.log();
      logger.error(
        i18n(`${i18nKey}.createInitialBuildForNewProject.projectLockedError`)
      );
      logger.log();
    } else {
      logError(
        uploadError,
        new ApiErrorContext({
          accountId: targetAccountId,
          projectName: projectConfig.name,
        })
      );
    }
    process.exit(EXIT_CODES.ERROR);
  }

  if (!initialUploadResult?.succeeded) {
    let subTasks: ProjectSubtask[] = [];

    if (initialUploadResult?.buildResult.status === 'FAILURE') {
      subTasks =
        initialUploadResult.buildResult[PROJECT_BUILD_TEXT.SUBTASK_KEY];
    } else if (initialUploadResult?.deployResult?.status === 'FAILURE') {
      subTasks =
        initialUploadResult.deployResult[PROJECT_DEPLOY_TEXT.SUBTASK_KEY];
    }

    const failedSubTasks = subTasks.filter(task => task.status === 'FAILURE');

    logger.log();
    failedSubTasks.forEach(failedSubTask => {
      logger.error(failedSubTask.errorMessage);
    });
    logger.log();

    process.exit(EXIT_CODES.ERROR);
  }

  return initialUploadResult.buildResult;
}

export function getAccountHomeUrl(accountId: number): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
  return `${baseUrl}/home?portalId=${accountId}`;
}
