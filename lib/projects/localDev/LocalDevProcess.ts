import {
  IntermediateRepresentationLocalDev,
  IntermediateRepresentationNodeLocalDev,
} from '@hubspot/project-parsing-lib/src/lib/types.js';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import { hasLocalStateFlag } from '@hubspot/local-dev-lib/config';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import path from 'path';
import open from 'open';

import { ProjectConfig, ProjectPollResult } from '../../../types/Projects.js';
import LocalDevState from './LocalDevState.js';
import LocalDevLogger from './LocalDevLogger.js';
import DevServerManagerV2 from './DevServerManagerV2.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { getProjectConfig } from '../config.js';
import { handleProjectUpload } from '../upload.js';
import { handleProjectDeploy } from '../deploy.js';
import { pollProjectBuildAndDeploy } from '../pollProjectBuildAndDeploy.js';
import {
  LocalDevStateConstructorOptions,
  LocalDevStateListener,
  LocalDevServerMessage,
  LocalDevProjectUploadResult,
  LocalDevProjectDeployResult,
} from '../../../types/LocalDev.js';
import { getLocalDevUiUrl } from '../urls.js';
import {
  CONFIG_LOCAL_STATE_FLAGS,
  PROJECT_DEPLOY_STATES,
} from '../../constants.js';
import { isAutoOpenBrowserEnabled } from '../../configOptions.js';
import { lib } from '../../../lang/en.js';
import { Deploy } from '@hubspot/local-dev-lib/types/Deploy';
import { debugError } from '../../errorHandlers/index.js';

class LocalDevProcess {
  private state: LocalDevState;
  private _logger: LocalDevLogger;
  private devServerManager: DevServerManagerV2;
  constructor(options: LocalDevStateConstructorOptions) {
    this.state = new LocalDevState(options);

    this._logger = new LocalDevLogger(this.state);
    this.devServerManager = new DevServerManagerV2({
      localDevState: this.state,
      logger: this._logger,
    });
  }

  get projectDir(): string {
    return this.state.projectDir;
  }

  get projectData(): Project {
    return this.state.projectData;
  }

  get targetProjectAccountId(): number {
    return this.state.targetProjectAccountId;
  }

  get targetTestingAccountId(): number {
    return this.state.targetTestingAccountId;
  }

  get projectNodes(): {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  } {
    return this.state.projectNodes;
  }

  get logger(): LocalDevLogger {
    return this._logger;
  }

  private async setupDevServers(): Promise<boolean> {
    try {
      await this.devServerManager.setup();
      return true;
    } catch (e) {
      this.logger.devServerSetupError(e);
      return false;
    }
  }

  private async startDevServers(): Promise<void> {
    try {
      await this.devServerManager.start();
    } catch (e) {
      this.logger.devServerStartError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  private async cleanupDevServers(): Promise<boolean> {
    try {
      await this.devServerManager.cleanup();
      return true;
    } catch (e) {
      this.logger.devServerCleanupError(e);
      return false;
    }
  }

  private async projectConfigValidForUpload(): Promise<boolean> {
    const { projectConfig } = await getProjectConfig();

    if (!projectConfig) {
      return false;
    }

    Object.keys(projectConfig).forEach(key => {
      const field = key as keyof ProjectConfig;
      if (projectConfig[field] !== this.state.projectConfig[field]) {
        return false;
      }
    });

    return true;
  }

  private getIntermediateRepresentation(projectNodesAtLastDeploy?: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  }): Promise<IntermediateRepresentationLocalDev> {
    return translateForLocalDev(
      {
        projectSourceDir: path.join(
          this.state.projectDir,
          this.state.projectConfig.srcDir
        ),
        platformVersion: this.state.projectConfig.platformVersion,
        accountId: this.state.targetProjectAccountId,
      },
      {
        projectNodesAtLastUpload: projectNodesAtLastDeploy,
        profile: this.state.profile,
      }
    );
  }

  private async updateProjectNodes(): Promise<void> {
    const intermediateRepresentation = await this.getIntermediateRepresentation(
      this.state.projectNodesAtLastDeploy
    );
    this.state.projectNodes =
      intermediateRepresentation.intermediateNodesIndexedByUid;
    this.state.projectProfileData = intermediateRepresentation.profileData;
  }

  private async updateProjectNodesAfterDeploy(): Promise<void> {
    const intermediateRepresentation =
      await this.getIntermediateRepresentation();
    this.state.projectNodes =
      intermediateRepresentation.intermediateNodesIndexedByUid;
    this.state.projectProfileData = intermediateRepresentation.profileData;
    this.state.projectNodesAtLastDeploy =
      intermediateRepresentation.intermediateNodesIndexedByUid;
  }

  private openLocalDevUi(): void {
    const showWelcomeScreen = !hasLocalStateFlag(
      CONFIG_LOCAL_STATE_FLAGS.LOCAL_DEV_UI_WELCOME
    );

    open(
      getLocalDevUiUrl(this.state.targetTestingAccountId, showWelcomeScreen)
    );
  }

  private async updateProjectData(): Promise<void> {
    try {
      const { data: projectData } = await fetchProject(
        this.state.targetProjectAccountId,
        this.state.projectConfig.name
      );
      this.state.projectData = projectData;
    } catch (e) {
      debugError(e);
    }
  }

  async handleFileChange(filePath: string, event: string): Promise<void> {
    await this.updateProjectNodes();
    try {
      this.devServerManager.fileChange({ filePath, event });
    } catch (e) {
      this.logger.fileChangeError(e);
    }
  }

  async handleConfigFileChange(): Promise<void> {
    await this.updateProjectNodes();
    this.logger.uploadWarning();
  }

  async start(): Promise<void> {
    this.logger.resetSpinnies();

    const setupSucceeded = await this.setupDevServers();

    if (!setupSucceeded) {
      process.exit(EXIT_CODES.ERROR);
    }

    this.logger.startupMessage();

    if (isAutoOpenBrowserEnabled()) {
      this.openLocalDevUi();
    }

    await this.startDevServers();

    this.logger.monitorConsoleOutput();
  }

  async stop(showProgress = true): Promise<void> {
    if (showProgress) {
      this.logger.cleanupStart();
    }

    const cleanupSucceeded = await this.cleanupDevServers();

    if (!cleanupSucceeded) {
      if (showProgress) {
        this.logger.cleanupError();
      }
      process.exit(EXIT_CODES.ERROR);
    }

    if (showProgress) {
      this.logger.cleanupSuccess();
    }
    process.exit(EXIT_CODES.SUCCESS);
  }

  async uploadProject(): Promise<LocalDevProjectUploadResult> {
    this.logger.uploadInitiated();
    const isUploadable = await this.projectConfigValidForUpload();

    if (!isUploadable) {
      this.logger.projectConfigMismatch();
      return {
        uploadSuccess: false,
        buildSuccess: false,
        deploySuccess: false,
      };
    }

    const { uploadError, result } =
      await handleProjectUpload<ProjectPollResult>({
        accountId: this.state.targetProjectAccountId,
        projectConfig: this.state.projectConfig,
        projectDir: this.state.projectDir,
        callbackFunc: pollProjectBuildAndDeploy,
        sendIR: true,
      });

    const deploy = result?.deployResult;

    if (uploadError) {
      this.logger.uploadError(uploadError);

      return {
        uploadSuccess: false,
        buildSuccess: false,
        deploySuccess: false,
        deployId: deploy?.deployId,
      };
    }

    await this.updateProjectData();

    if (deploy && deploy.status === PROJECT_DEPLOY_STATES.FAILURE) {
      return {
        uploadSuccess: false,
        buildSuccess: true,
        deploySuccess: false,
        deployId: deploy.deployId,
      };
    } else if (!deploy) {
      this.logger.uploadSuccessAutoDeployDisabled();
    } else {
      await this.updateProjectNodesAfterDeploy();
      this.state.clearUploadWarnings();
      this.logger.uploadSuccess();
    }

    return {
      uploadSuccess: true,
      buildSuccess: true,
      deploySuccess: Boolean(deploy),
      deployId: deploy?.deployId,
    };
  }

  async deployLatestBuild(force = false): Promise<LocalDevProjectDeployResult> {
    this.logger.deployInitiated();

    if (!this.state.projectData.latestBuild) {
      this.logger.deployError(lib.LocalDevProcess.noBuildToDeploy);
      return {
        success: false,
      };
    }

    let deploy: Deploy | undefined;

    try {
      deploy = await handleProjectDeploy(
        this.state.targetProjectAccountId,
        this.state.projectConfig.name,
        this.state.projectData.latestBuild.buildId,
        true,
        force
      );
    } catch (error) {
      this.logger.deployError(error);

      return {
        success: false,
      };
    }

    const success = deploy?.status === PROJECT_DEPLOY_STATES.SUCCESS;

    if (success) {
      await this.updateProjectData();

      this.logger.deploySuccess();
      await this.updateProjectNodesAfterDeploy();
      this.state.clearUploadWarnings();
    } else {
      this.logger.deployError();
    }

    return {
      success,
      deployId: deploy?.deployId,
    };
  }

  addStateListener<K extends keyof LocalDevState>(
    key: K,
    listener: LocalDevStateListener<K>
  ): void {
    this.state.addListener(key, listener);
  }

  sendDevServerMessage(message: LocalDevServerMessage): void {
    this.state.devServerMessage = message;
  }

  removeStateListener<K extends keyof LocalDevState>(
    key: K,
    listener: LocalDevStateListener<K>
  ): void {
    this.state.removeListener(key, listener);
  }
}

export default LocalDevProcess;
