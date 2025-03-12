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

  // TODO ideally this should require the user to target a Combined account
  const defaultAccountIsRecommendedType =
    isAppDeveloperAccount(accountConfig) || isStandardAccount(accountConfig);

  if (!defaultAccountIsRecommendedType) {
    logger.error(
      'You must target a Combined account to use Unified Apps Local Dev'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let targetTestingAccountId = null;
  let createNewDeveloperTestAccount = false;

  const devAccountPromptResponse = await selectDeveloperTestTargetAccountPrompt(
    accounts!,
    accountConfig
  );

  targetTestingAccountId = devAccountPromptResponse.targetAccountId;
  createNewDeveloperTestAccount = devAccountPromptResponse.createNestedAccount;

  // When the developer test account isn't in the CLI config yet
  if (!!devAccountPromptResponse.notInConfigAccount) {
    await useExistingDevTestAccount(
      env,
      devAccountPromptResponse.notInConfigAccount
    );
  }

  if (createNewDeveloperTestAccount) {
    targetTestingAccountId = await createDeveloperTestAccountForLocalDev(
      targetAccountId,
      accountConfig,
      env
    );
  }

  console.log('targetTestingAccountId: ', targetTestingAccountId);

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
    projectConfig,
    projectDir,
    projectId: project.id,
    env,
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
}
