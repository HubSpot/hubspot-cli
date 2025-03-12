import path from 'path';
import util from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { isTranslationError } from '@hubspot/project-parsing-lib/src/lib/errors';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { getEnv, getConfigAccounts } from '@hubspot/local-dev-lib/config';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { ProjectDevArgs } from '../../../types/Yargs';
import { ProjectConfig } from '../../../types/Projects';
import { logError } from '../../../lib/errorHandlers';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { ensureProjectExists } from '../../../lib/projects';
import {
  createInitialBuildForNewProject,
  createNewProjectForLocalDev,
  useExistingDevTestAccount,
  createDeveloperTestAccountForLocalDev,
} from '../../../lib/localDev';
import { selectDeveloperTestTargetAccountPrompt } from '../../../lib/prompts/projectDevTargetAccountPrompt';
import SpinniesManager from '../../../lib/ui/SpinniesManager';
import LocalDevManagerV2 from '../../../lib/LocalDevManagerV2';
import { handleExit } from '../../../lib/process';
import {
  isAppDeveloperAccount,
  isStandardAccount,
} from '../../../lib/accountTypes';

export async function unifiedProjectDevFlow(
  args: ArgumentsCamelCase<ProjectDevArgs>,
  accountConfig: CLIAccount,
  projectConfig: ProjectConfig,
  projectDir: string
): Promise<void> {
  logger.log('Unified Apps Local Dev');

  const targetAccountId = args.derivedAccountId;
  const env = getValidEnv(getEnv(targetAccountId));

  let intermediateRepresentation;

  // Get IR
  try {
    intermediateRepresentation = await translateForLocalDev({
      projectSourceDir: path.join(projectDir, projectConfig.srcDir),
      platformVersion: projectConfig.platformVersion,
      accountId: targetAccountId,
    });

    logger.debug(util.inspect(intermediateRepresentation, false, null, true));
  } catch (e) {
    if (isTranslationError(e)) {
      logger.error(e.toString());
    } else {
      logError(e);
    }
    return process.exit(EXIT_CODES.ERROR);
  }

  // @TODO: Check if there are runnable components and exit if not

  const accounts = getConfigAccounts();

  // TODO Ideally this should require the user to target a Combined account
  // For now, check if the account is either developer or standard
  const defaultAccountIsRecommendedType =
    isAppDeveloperAccount(accountConfig) || isStandardAccount(accountConfig);

  if (!defaultAccountIsRecommendedType) {
    logger.error(
      'You must target a Combined account to use Unified Apps Local Dev'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let targetTestingAccountId = null;

  const devAccountPromptResponse = await selectDeveloperTestTargetAccountPrompt(
    accounts!,
    accountConfig
  );

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
      targetAccountId,
      accountConfig,
      env
    );
  }

  // Check if project exists in HubSpot
  const { projectExists, project: uploadedProject } = await ensureProjectExists(
    targetAccountId,
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
      targetAccountId,
      false,
      false
    );

    deployedBuild = await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetAccountId
    );
  }

  const LocalDev = new LocalDevManagerV2({
    intermediateRepresentation,
    debug: args.debug,
    deployedBuild,
    isGithubLinked,
    targetAccountId,
    targetTestingAccountId: targetTestingAccountId!,
    projectConfig,
    projectDir,
    projectId: project.id,
    env,
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
}
