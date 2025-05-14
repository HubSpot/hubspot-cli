import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import path from 'path';

import { ProjectConfig, ProjectPollResult } from '../../../types/Projects';
import LocalDevState from './LocalDevState';
import LocalDevLogger from './LocalDevLogger';
import DevServerManagerV2 from './DevServerManagerV2';
import { EXIT_CODES } from '../../enums/exitCodes';
import { mapToUserFriendlyName } from '@hubspot/project-parsing-lib/src/lib/transform';
import { getProjectConfig } from '../config';
import { handleProjectUpload } from '../upload';
import { pollProjectBuildAndDeploy } from '../buildAndDeploy';
import { LocalDevStateConstructorOptions } from '../../../types/LocalDev';

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

  private compareLocalProjectToDeployed(): void {
    const deployedComponentNames =
      this.state.deployedBuild!.subbuildStatuses.map(
        subbuildStatus => subbuildStatus.buildName
      );

    const missingProjectNodes: string[] = [];

    Object.values(this.projectNodes).forEach(node => {
      if (!deployedComponentNames.includes(node.uid)) {
        const userFriendlyName = mapToUserFriendlyName(node.componentType);
        const label = userFriendlyName ? `[${userFriendlyName}] ` : '';
        missingProjectNodes.push(`${label}${node.uid}`);
      }
    });

    if (missingProjectNodes.length) {
      this.logger.missingComponentsWarning(missingProjectNodes);
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

  handleFileChange(filePath: string, event: string): void {
    try {
      this.devServerManager.fileChange({ filePath, event });
    } catch (e) {
      this.logger.fileChangeError(e);
    }
  }

  async start(): Promise<void> {
    this.logger.resetSpinnies();

    // Local dev currently relies on the existence of a deployed build in the target account
    if (!this.state.deployedBuild) {
      this.logger.noDeployedBuild();
      process.exit(EXIT_CODES.SUCCESS);
    }

    const setupSucceeded = await this.setupDevServers();

    if (!setupSucceeded) {
      process.exit(EXIT_CODES.ERROR);
    }

    this.logger.startupMessage();

    await this.startDevServers();

    this.logger.monitorConsoleOutput();

    // Verify that there are no mismatches between components in the local project
    // and components in the deployed build of the project.
    this.compareLocalProjectToDeployed();
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

  async updateProjectNodes() {
    const intermediateRepresentation = await translateForLocalDev({
      projectSourceDir: path.join(
        this.state.projectDir,
        this.state.projectConfig.srcDir
      ),
      platformVersion: this.state.projectConfig.platformVersion,
      accountId: this.state.targetProjectAccountId,
    });

    this.state.projectNodes =
      intermediateRepresentation.intermediateNodesIndexedByUid;
  }

  async uploadProject(): Promise<void> {
    this.logger.uploadInitiated();
    const isUploadable = await this.projectConfigValidForUpload();

    if (!isUploadable) {
      this.logger.projectConfigMismatch();
      return;
    }

    const { uploadError } = await handleProjectUpload<ProjectPollResult>({
      accountId: this.state.targetProjectAccountId,
      projectConfig: this.state.projectConfig,
      projectDir: this.state.projectDir,
      callbackFunc: pollProjectBuildAndDeploy,
      sendIR: true,
      skipValidation: true,
    });

    if (uploadError) {
      this.logger.uploadError(uploadError);
    } else {
      this.logger.uploadSuccess();
      this.logger.clearUploadWarnings();
    }
  }
}

export default LocalDevProcess;
