import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FileResult } from 'tmp';

import { createProject } from '@hubspot/local-dev-lib/api/projects';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { isDeepEqual } from '@hubspot/local-dev-lib/isDeepEqual';
import { translate } from '@hubspot/project-parsing-lib';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types.js';

import {
  PROJECT_ERROR_TYPES,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
} from '../../../constants.js';
import { lib } from '../../../../lang/en.js';
import { uiLogger } from '../../../ui/logger.js';
import { uiLine } from '../../../ui/index.js';
import { confirmPrompt } from '../../../prompts/promptUtils.js';
import { uiAccountDescription } from '../../../ui/index.js';
import SpinniesManager from '../../../ui/SpinniesManager.js';
import { EXIT_CODES } from '../../../enums/exitCodes.js';
import { handleProjectUpload } from '../../upload.js';
import { pollProjectBuildAndDeploy } from '../../pollProjectBuildAndDeploy.js';
import { debugError, logError } from '../../../errorHandlers/index.js';
import { ApiErrorContext } from '../../../errorHandlers/index.js';
import { ProjectConfig } from '../../../../types/Projects.js';
import { ProjectPollResult } from '../../../../types/Projects.js';
import { ProjectSubtask } from '../../../../types/Projects.js';

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
    const explanationLangFunction = hasPublicApps
      ? lib.localDevHelpers.project.createNewProjectForLocalDev
          .publicAppProjectMustExistExplanation
      : lib.localDevHelpers.project.createNewProjectForLocalDev
          .projectMustExistExplanation;

    const explanationString = explanationLangFunction(
      projectConfig.name,
      targetAccountId
    );

    uiLogger.log('');
    uiLine();
    uiLogger.log(explanationString);
    uiLine();

    shouldCreateProject = await confirmPrompt(
      lib.localDevHelpers.project.createNewProjectForLocalDev.createProject(
        projectConfig.name,
        uiAccountDescription(targetAccountId)
      )
    );
  }

  if (shouldCreateProject) {
    SpinniesManager.add('createProject', {
      text: lib.localDevHelpers.project.createNewProjectForLocalDev.creatingProject(
        projectConfig.name,
        uiAccountDescription(targetAccountId)
      ),
    });

    try {
      const { data: project } = await createProject(
        targetAccountId,
        projectConfig.name
      );
      SpinniesManager.succeed('createProject', {
        text: lib.localDevHelpers.project.createNewProjectForLocalDev.createdProject(
          projectConfig.name,
          uiAccountDescription(targetAccountId)
        ),
        succeedColor: 'white',
      });
      return project;
    } catch (err) {
      SpinniesManager.fail('createProject');
      uiLogger.log(
        lib.localDevHelpers.project.createNewProjectForLocalDev
          .failedToCreateProject
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    // We cannot continue if the project does not exist in the target account
    uiLogger.log('');
    uiLogger.log(
      lib.localDevHelpers.project.createNewProjectForLocalDev
        .choseNotToCreateProject
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
    uiLogger.error(
      lib.localDevHelpers.project.createInitialBuildForNewProject.genericError
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
  sendIR?: boolean,
  profile?: string
): Promise<Build> {
  const { result: initialUploadResult, uploadError } =
    await handleProjectUpload<ProjectPollResult>({
      accountId: targetAccountId,
      projectConfig,
      projectDir,
      callbackFunc: projectUploadCallback,
      uploadMessage:
        lib.localDevHelpers.project.createInitialBuildForNewProject
          .initialUploadMessage,
      forceCreate: true,
      skipValidation: true,
      sendIR,
      profile,
    });

  if (uploadError) {
    if (
      isSpecifiedError(uploadError, {
        subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
      })
    ) {
      uiLogger.log('');
      uiLogger.error(
        lib.localDevHelpers.project.createInitialBuildForNewProject
          .projectLockedError
      );
      uiLogger.log('');
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

    uiLogger.log('');
    failedSubTasks.forEach(failedSubTask => {
      uiLogger.error(failedSubTask.errorMessage);
    });
    uiLogger.log('');

    process.exit(EXIT_CODES.ERROR);
  }

  return initialUploadResult.buildResult;
}

export async function compareLocalProjectToDeployed(
  projectConfig: ProjectConfig,
  accountId: number,
  deployedBuildId: number | undefined,
  localProjectNodes: { [key: string]: IntermediateRepresentationNodeLocalDev },
  profile?: string
): Promise<void> {
  uiLogger.log('');

  if (!deployedBuildId) {
    uiLogger.error(
      lib.localDevHelpers.project.compareLocalProjectToDeployed.noDeployedBuild(
        projectConfig.name,
        uiAccountDescription(accountId)
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  SpinniesManager.add('compareLocalProjectToDeployed', {
    text: lib.localDevHelpers.project.compareLocalProjectToDeployed.checking,
  });

  const isUpToDate = await isDeployedProjectUpToDateWithLocal(
    projectConfig,
    accountId,
    deployedBuildId,
    localProjectNodes,
    profile
  );

  if (isUpToDate) {
    SpinniesManager.succeed('compareLocalProjectToDeployed', {
      text: lib.localDevHelpers.project.compareLocalProjectToDeployed.upToDate,
    });
  } else {
    SpinniesManager.fail('compareLocalProjectToDeployed', {
      text: lib.localDevHelpers.project.compareLocalProjectToDeployed
        .notUpToDate,
    });
    uiLogger.log('');
    uiLogger.log(
      lib.localDevHelpers.project.compareLocalProjectToDeployed.notUpToDateExplanation(
        profile
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}
export async function isDeployedProjectUpToDateWithLocal(
  projectConfig: ProjectConfig,
  accountId: number,
  deployedBuildId: number,
  localProjectNodes: { [key: string]: IntermediateRepresentationNodeLocalDev },
  profile?: string
): Promise<boolean> {
  let tempDir: string | null = null;

  try {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'hubspot-project-compare-')
    );

    const { data: zippedProject } = await downloadProject(
      accountId,
      projectConfig.name,
      deployedBuildId
    );

    const extractedProjectPath = path.join(
      tempDir,
      sanitizeFileName(projectConfig.name)
    );
    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectConfig.name),
      tempDir,
      { includesRootDir: false, hideLogs: true }
    );

    const deployedProjectSourceDir = path.join(
      extractedProjectPath,
      projectConfig.srcDir
    );

    const { intermediateNodesIndexedByUid: deployedProjectNodes } =
      await translate(
        {
          projectSourceDir: deployedProjectSourceDir,
          platformVersion: projectConfig.platformVersion,
          accountId: accountId,
        },
        { profile }
      );

    return isDeepEqual(localProjectNodes, deployedProjectNodes, ['localDev']);
  } catch (err) {
    debugError(err);
    return false;
  } finally {
    // Clean up temporary directory
    if (tempDir && (await fs.pathExists(tempDir))) {
      await fs.remove(tempDir);
    }
  }
}
