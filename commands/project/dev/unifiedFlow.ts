import path from 'path';
import util from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  startPortManagerServer,
  stopPortManagerServer,
} from '@hubspot/local-dev-lib/portManager';
import { isTranslationError } from '@hubspot/project-parsing-lib/src/lib/errors.js';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import {
  HsProfileFile,
  HSProfileVariables,
} from '@hubspot/project-parsing-lib/src/lib/types.js';
import {
  getEnv,
  getConfigAccounts,
  getAccountConfig,
} from '@hubspot/local-dev-lib/config';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { ProjectDevArgs } from '../../../types/Yargs.js';
import { ProjectConfig } from '../../../types/Projects.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists.js';
import {
  createInitialBuildForNewProject,
  createNewProjectForLocalDev,
  compareLocalProjectToDeployed,
  checkAndInstallDependencies,
} from '../../../lib/projects/localDev/helpers/project.js';
import {
  useExistingDevTestAccount,
  createDeveloperTestAccountForLocalDev,
  selectAccountTypePrompt,
  createSandboxForLocalDev,
} from '../../../lib/projects/localDev/helpers/account.js';
import {
  selectDeveloperTestTargetAccountPrompt,
  selectSandboxTargetAccountPrompt,
} from '../../../lib/prompts/projectDevTargetAccountPrompt.js';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import LocalDevProcess from '../../../lib/projects/localDev/LocalDevProcess.js';
import LocalDevWatcher from '../../../lib/projects/localDev/LocalDevWatcher.js';
import { handleExit, handleKeypress } from '../../../lib/process.js';
import {
  isTestAccountOrSandbox,
  isUnifiedAccount,
} from '../../../lib/accountTypes.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { commands } from '../../../lang/en.js';
import LocalDevWebsocketServer from '../../../lib/projects/localDev/LocalDevWebsocketServer.js';

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
}: UnifiedProjectDevFlowArgs): Promise<void> {
  const env = getValidEnv(getEnv(targetProjectAccountId));

  let projectNodes;
  let projectProfileData: HSProfileVariables | undefined;

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
    projectProfileData = intermediateRepresentation.profileData;

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
  const targetProjectAccountIsTestAccountOrSandbox = isTestAccountOrSandbox(
    targetProjectAccountConfig
  );

  if (!accountIsCombined) {
    uiLogger.error(commands.project.dev.errors.accountNotCombined);
    process.exit(EXIT_CODES.ERROR);
  }

  let targetTestingAccountId = providedTargetTestingAccountId;

  // Temporarily removing logic to use profile account as testing account
  // if (profileConfig) {
  //   // Bypass the prompt for the testing account if the user has a profile configured
  //   targetTestingAccountId = profileConfig.accountId;
  // } else

  if (
    // Bypass the prompt for the testing account if default account is already a test account
    !targetTestingAccountId &&
    targetProjectAccountIsTestAccountOrSandbox
  ) {
    targetTestingAccountId = targetProjectAccountId;
    uiLogger.log(
      commands.project.dev.logs.defaultSandboxOrDevTestTestingAccountExplanation(
        targetProjectAccountId
      )
    );
  } else if (!targetTestingAccountId) {
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
          env,
          true
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

      if (sandboxAccountPromptResponse.createNestedAccount) {
        targetTestingAccountId = await createSandboxForLocalDev(
          targetProjectAccountId,
          targetProjectAccountConfig,
          env
        );
      }
    } else {
      targetTestingAccountId = targetProjectAccountId;
    }
  } else {
    uiLogger.log(
      commands.project.dev.logs.testingAccountFlagExplanation(
        targetTestingAccountId
      )
    );
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

  let project = uploadedProject;

  SpinniesManager.init();

  if (projectExists && project) {
    await compareLocalProjectToDeployed(
      projectConfig,
      targetProjectAccountId,
      project.deployedBuild?.buildId,
      projectNodes,
      args.profile
    );
  } else {
    project = await createNewProjectForLocalDev(
      projectConfig,
      targetProjectAccountId,
      false,
      false
    );

    await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetProjectAccountId,
      true,
      args.profile
    );
  }

  // Check for missing/outdated dependencies
  await checkAndInstallDependencies();

  // End setup, start local dev process
  await startPortManagerServer();

  const localDevProcess = new LocalDevProcess({
    initialProjectNodes: projectNodes,
    initialProjectProfileData: projectProfileData,
    debug: args.debug,
    profile: args.profile,
    targetProjectAccountId,
    targetTestingAccountId: targetTestingAccountId!,
    projectConfig,
    projectDir,
    projectData: project,
    env,
  });

  const websocketServer = new LocalDevWebsocketServer(
    localDevProcess,
    args.debug
  );
  const watcher = new LocalDevWatcher(localDevProcess);

  await websocketServer.start();
  await localDevProcess.start();
  watcher.start();

  handleKeypress(async key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      await Promise.all([
        localDevProcess.stop(),
        watcher.stop(),
        websocketServer.shutdown(),
      ]);
    }
  });

  handleExit(({ isSIGHUP }) => {
    localDevProcess.stop(!isSIGHUP);
    watcher.stop();
    websocketServer.shutdown();
    stopPortManagerServer();
  });
}
