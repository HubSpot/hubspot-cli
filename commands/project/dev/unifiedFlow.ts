import path from 'path';
import util from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { isTranslationError } from '@hubspot/project-parsing-lib/src/lib/errors';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import {
  getEnv,
  getConfigAccounts,
  getAccountConfig,
} from '@hubspot/local-dev-lib/config';
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

type UnifiedProjectDevFlowArgs = {
  args: ArgumentsCamelCase<ProjectDevArgs>;
  targetProjectAccountId: number;
  providedTargetTestingAccountId?: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  profileConfig?: HsProfileFile;
};

export async function unifiedProjectDevFlow({
  args,
  targetProjectAccountId,
  providedTargetTestingAccountId,
  projectConfig,
  projectDir,
  profileConfig,
}: UnifiedProjectDevFlowArgs): Promise<void> {
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

    uiLogger.debug(util.inspect(projectNodes, false, null, true));
  } catch (e) {
    if (isTranslationError(e)) {
      uiLogger.error(e.toString());
    } else {
      logError(e);
    }
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!Object.keys(projectNodes).length) {
    uiLogger.error(commands.project.dev.errors.noRunnableComponents);
    process.exit(EXIT_CODES.SUCCESS);
  }

  const targetProjectAccountConfig = getAccountConfig(targetProjectAccountId);
  if (!targetProjectAccountConfig) {
    uiLogger.error(
      commands.project.dev.errors.noAccount(targetProjectAccountId)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const accounts = getConfigAccounts();
  const accountIsCombined = await isUnifiedAccount(targetProjectAccountConfig);

  if (!accountIsCombined && !profileConfig) {
    uiLogger.log('');
    uiLogger.error(commands.project.dev.errors.accountNotCombined);
    process.exit(EXIT_CODES.ERROR);
  }

  let targetTestingAccountId = providedTargetTestingAccountId;

  if (profileConfig) {
    // Bypass the prompt for the testing account if the user has a profile configured
    targetTestingAccountId = profileConfig.accountId;
  } else if (!targetTestingAccountId) {
    uiLogger.log('');
    uiLine();
    uiLogger.log(commands.project.dev.logs.accountTypeInformation);
    uiLogger.log('');
    uiLogger.log(commands.project.dev.logs.learnMoreMessage);
    uiLine();
    uiLogger.log('');

    const accountType = await selectAccountTypePrompt(
      targetProjectAccountConfig
    );

    if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST) {
      const devAccountPromptResponse =
        await selectDeveloperTestTargetAccountPrompt(
          accounts!,
          targetProjectAccountConfig
        );

      targetTestingAccountId =
        devAccountPromptResponse.targetAccountId || undefined;

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
          targetProjectAccountConfig,
          env
        );
      }
    } else if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      const sandboxAccountPromptResponse =
        await selectSandboxTargetAccountPrompt(
          accounts!,
          targetProjectAccountConfig
        );

      targetTestingAccountId =
        sandboxAccountPromptResponse.targetAccountId || undefined;
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
