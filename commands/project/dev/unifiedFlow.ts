import path from 'path';
import util from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
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
  selectAccountTypePrompt,
} from '../../../lib/projects/localDev/helpers';
import {
  selectDeveloperTestTargetAccountPrompt,
  selectSandboxTargetAccountPrompt,
} from '../../../lib/prompts/projectDevTargetAccountPrompt';
import SpinniesManager from '../../../lib/ui/SpinniesManager';
import LocalDevProcess from '../../../lib/projects/localDev/LocalDevProcess';
import LocalDevWatcher from '../../../lib/projects/localDev/LocalDevWatcher';
import { handleExit, handleKeypress } from '../../../lib/process';
import { isUnifiedAccount } from '../../../lib/accountTypes';
import { uiLine } from '../../../lib/ui';
import { uiLogger } from '../../../lib/ui/logger';
import { commands } from '../../../lang/en';

// import LocalDevWebsocketServer from '../../../lib/projects/localDev/LocalDevWebsocketServer';

export async function unifiedProjectDevFlow(
  args: ArgumentsCamelCase<ProjectDevArgs>,
  accountConfig: CLIAccount,
  projectConfig: ProjectConfig,
  projectDir: string,
  profileConfig?: HsProfileFile
): Promise<void> {
  const targetProjectAccountId = getAccountIdentifier(accountConfig);
  const env = getValidEnv(getEnv(targetProjectAccountId));

  if (!targetProjectAccountId) {
    process.exit(EXIT_CODES.ERROR);
  }

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

    uiLogger.debug(util.inspect(projectNodes, false, null, true));
  } catch (e) {
    if (isTranslationError(e)) {
      uiLogger.error(e.toString());
    } else {
      logError(e);
    }
    return process.exit(EXIT_CODES.ERROR);
  }

  // @TODO Do we need to do more than this or leave it to the dev servers?
  if (!Object.keys(projectNodes).length) {
    uiLogger.error(commands.project.dev.errors.noRunnableComponents);
    process.exit(EXIT_CODES.SUCCESS);
  }

  // @TODO Validate component types (i.e. previously you could not have both private and public apps)

  const accounts = getConfigAccounts();
  const accountIsCombined = await isUnifiedAccount(accountConfig);

  if (!accountIsCombined && !profileConfig) {
    uiLogger.log('');
    uiLogger.error(commands.project.dev.errors.accountNotCombined);
    process.exit(EXIT_CODES.ERROR);
  }

  let targetTestingAccountId = null;

  if (profileConfig) {
    // Bypass the prompt for the testing account if the user has a profile configured
    targetTestingAccountId = profileConfig.accountId;
  } else if (args.providedAccountId) {
    // By pass the prompt if the user explicitly provides an --account flag.
    targetTestingAccountId = targetProjectAccountId;
  } else {
    uiLogger.log('');
    uiLine();
    uiLogger.log(commands.project.dev.logs.accountTypeInformation);
    uiLogger.log('');
    uiLogger.log(commands.project.dev.logs.learnMoreMessage);
    uiLine();
    uiLogger.log('');

    const accountType = await selectAccountTypePrompt(accountConfig);

    if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST) {
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
    } else if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      const sandboxAccountPromptResponse =
        await selectSandboxTargetAccountPrompt(accounts!, accountConfig);

      targetTestingAccountId = sandboxAccountPromptResponse.targetAccountId;
    } else {
      targetTestingAccountId = targetProjectAccountId;
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

  // End setup, start local dev process
  const localDevProcess = new LocalDevProcess({
    initialProjectNodes: projectNodes,
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

  await localDevProcess.start();

  const watcher = new LocalDevWatcher(localDevProcess);
  watcher.start();

  // const websocketServer = new LocalDevWebsocketServer(
  //   localDevProcess,
  //   args.debug
  // );
  // await websocketServer.start();

  handleKeypress(async key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      await Promise.all([
        localDevProcess.stop(),
        watcher.stop(),
        // websocketServer.shutdown(),
      ]);
    }
  });

  handleExit(({ isSIGHUP }) => {
    localDevProcess.stop(!isSIGHUP);
    watcher.stop();
    // websocketServer.shutdown();
  });
}
