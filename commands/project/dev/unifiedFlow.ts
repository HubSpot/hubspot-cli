import path from 'path';
import util from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { isTranslationError } from '@hubspot/project-parsing-lib/src/lib/errors';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { getEnv, getConfigAccounts } from '@hubspot/local-dev-lib/config';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { ProjectDevArgs } from '../../../types/Yargs';
import { ProjectConfig } from '../../../types/Projects';
import { logError } from '../../../lib/errorHandlers';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists';
import {
  createInitialBuildForNewProject,
  createNewProjectForLocalDev,
  useExistingDevTestAccount,
  createDeveloperTestAccountForLocalDev,
} from '../../../lib/projects/localDev/helpers';
import { selectDeveloperTestTargetAccountPrompt } from '../../../lib/prompts/projectDevTargetAccountPrompt';
import SpinniesManager from '../../../lib/ui/SpinniesManager';
import LocalDevManagerV2 from '../../../lib/projects/localDev/LocalDevManagerV2';
import { handleExit } from '../../../lib/process';
import {
  isAppDeveloperAccount,
  isStandardAccount,
} from '../../../lib/accountTypes';
import { uiCommandReference } from '../../../lib/ui';
import { i18n } from '../../../lib/lang';

export async function unifiedProjectDevFlow(
  args: ArgumentsCamelCase<ProjectDevArgs>,
  accountConfig: CLIAccount,
  projectConfig: ProjectConfig,
  projectDir: string,
  profileConfig?: HsProfileFile
): Promise<void> {
  logger.log('Unified Apps Local Dev');

  const targetProjectAccountId =
    profileConfig?.accountId || args.derivedAccountId;
  const env = getValidEnv(getEnv(targetProjectAccountId));

  let projectNodes;

  // Get IR
  try {
    const intermediateRepresentation = await translateForLocalDev(
      {
        projectSourceDir: path.join(projectDir, projectConfig.srcDir),
        platformVersion: projectConfig.platformVersion,
        accountId: targetProjectAccountId,
      },
      { profile: args.profile }
    );

    projectNodes = intermediateRepresentation.intermediateNodesIndexedByUid;

    logger.debug(util.inspect(projectNodes, false, null, true));
  } catch (e) {
    if (isTranslationError(e)) {
      logger.error(e.toString());
    } else {
      logError(e);
    }
    return process.exit(EXIT_CODES.ERROR);
  }

  // @TODO Do we need to do more than this or leave it to the dev servers?
  if (!Object.keys(projectNodes).length) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.noRunnableComponents`, {
        projectDir,
        command: uiCommandReference('hs project add'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  // @TODO Validate component types (i.e. previously you could not have both private and public apps)

  const accounts = getConfigAccounts();

  // TODO Ideally this should require the user to target a Combined account
  // For now, check if the account is either developer or standard
  const derivedAccountIsRecommendedType =
    isAppDeveloperAccount(accountConfig) || isStandardAccount(accountConfig);

  if (!derivedAccountIsRecommendedType && !profileConfig) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.invalidUnifiedAppsAccount`),
      {
        authCommand: uiCommandReference('hs auth'),
      }
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  let targetTestingAccountId = null;

  if (profileConfig) {
    // Bypass the prompt for the testing account if the user has a profile configured
    targetTestingAccountId = profileConfig.accountId;
  } else {
    const devAccountPromptResponse =
      await selectDeveloperTestTargetAccountPrompt(accounts!, accountConfig);

    targetTestingAccountId = devAccountPromptResponse.targetAccountId;

    if (!!devAccountPromptResponse.notInConfigAccount) {
      // When the developer test account isn't configured in the CLI config yet
      // Walk the user through adding the account's PAK to the config
      await useExistingDevTestAccount(
        env,
        devAccountPromptResponse.notInConfigAccount
      );
    } else if (devAccountPromptResponse.createNestedAccount) {
      // Create a new developer test account and automatically add it to the CLI config
      targetTestingAccountId = await createDeveloperTestAccountForLocalDev(
        targetProjectAccountId,
        accountConfig,
        env
      );
    }
  }

  // Check if project exists in HubSpot
  const { projectExists, project: uploadedProject } = await ensureProjectExists(
    targetProjectAccountId,
    projectConfig.name,
    {
      allowCreate: false,
      noLogs: true,
    }
  );

  let deployedBuild;
  let isGithubLinked = false;
  let project = uploadedProject;

  SpinniesManager.init();

  if (projectExists && project) {
    deployedBuild = project.deployedBuild;
    isGithubLinked = Boolean(
      project.sourceIntegration && project.sourceIntegration.source === 'GITHUB'
    );
  } else {
    project = await createNewProjectForLocalDev(
      projectConfig,
      targetProjectAccountId,
      false,
      false
    );

    deployedBuild = await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetProjectAccountId,
      true,
      args.profile
    );
  }

  const LocalDev = new LocalDevManagerV2({
    projectNodes,
    debug: args.debug,
    deployedBuild,
    isGithubLinked,
    targetProjectAccountId,
    targetTestingAccountId: targetTestingAccountId!,
    projectConfig,
    projectDir,
    projectId: project.id,
    env,
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
}
