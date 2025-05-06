import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import path from 'path';

import { ProjectConfig } from '../../../types/Projects';
import { LocalDevState } from '../../../types/LocalDev';
import LocalDevLogger from './LocalDevLogger';
import DevServerManagerV2 from './DevServerManagerV2';
import { EXIT_CODES } from '../../enums/exitCodes';
import { mapToUserFriendlyName } from '@hubspot/project-parsing-lib/src/lib/transform';

type LocalDevProcessConstructorOptions = {
  targetProjectAccountId: number;
  targetTestingAccountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectId: number;
  debug?: boolean;
  deployedBuild?: Build;
  isGithubLinked: boolean;
  initialProjectNodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  };
  env: Environment;
};

class LocalDevProcess {
  private state: LocalDevState;
  private _logger: LocalDevLogger;
  private devServerManager: DevServerManagerV2;
  constructor({
    targetProjectAccountId,
    targetTestingAccountId,
    projectConfig,
    projectDir,
    projectId,
    debug,
    deployedBuild,
    isGithubLinked,
    initialProjectNodes,
    env,
  }: LocalDevProcessConstructorOptions) {
    this.state = {
      targetProjectAccountId,
      targetTestingAccountId,
      projectConfig,
      projectDir,
      projectId,
      debug: debug || false,
      deployedBuild,
      isGithubLinked,
      projectNodes: initialProjectNodes,
      env,
    };

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
}

export default LocalDevProcess;
