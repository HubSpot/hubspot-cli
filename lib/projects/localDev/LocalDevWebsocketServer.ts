import { WebSocket } from 'ws';
import { addLocalStateFlag } from '@hubspot/local-dev-lib/config';
import {
  LOCAL_DEV_UI_MESSAGE_SEND_TYPES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
  CONFIG_LOCAL_STATE_FLAGS,
  LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID,
} from '../../constants.js';
import { AppLocalDevData } from '../../../types/LocalDev.js';
import LocalDevProcess from './LocalDevProcess.js';
import type { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/translate';
import { removeAnsiCodes } from '../../ui/removeAnsiCodes.js';
import {
  isDeployWebsocketMessage,
  isViewedWelcomeScreenWebsocketMessage,
  isUploadWebsocketMessage,
  isAppInstallFailureWebsocketMessage,
  isAppInstallSuccessWebsocketMessage,
  isAppInstallInitiatedWebsocketMessage,
} from './localDevWebsocketServerUtils.js';
import CLIWebSocketServer, {
  CLIWebSocketMessage,
} from '../../CLIWebSocketServer.js';

const LOCAL_DEV_WEBSOCKET_SERVER_VERSION = 2;
const LOG_PREFIX = '[LocalDevWebsocketServer]';

class LocalDevWebsocketServer {
  private cliWebSocketServer: CLIWebSocketServer;
  private localDevProcess: LocalDevProcess;

  constructor(localDevProcess: LocalDevProcess, debug?: boolean) {
    this.localDevProcess = localDevProcess;
    this.cliWebSocketServer = new CLIWebSocketServer({
      instanceId: LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID,
      logPrefix: LOG_PREFIX,
      debug,
    });
  }

  private async handleUpload(websocket: WebSocket): Promise<void> {
    const { uploadSuccess, buildSuccess, deploySuccess, deployId } =
      await this.localDevProcess.uploadProject();

    this.cliWebSocketServer.sendMessage(websocket, {
      type: uploadSuccess
        ? LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPLOAD_SUCCESS
        : LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPLOAD_FAILURE,
      data: {
        latestBuild: this.localDevProcess.projectData.latestBuild,
        deployedBuild: this.localDevProcess.projectData.deployedBuild,
        buildSuccess,
        deploySuccess,
        deployId,
      },
    });
  }

  private async handleDeploy(
    websocket: WebSocket,
    force: boolean
  ): Promise<void> {
    const { success, deployId } =
      await this.localDevProcess.deployLatestBuild(force);

    this.cliWebSocketServer.sendMessage(websocket, {
      type: success
        ? LOCAL_DEV_UI_MESSAGE_SEND_TYPES.DEPLOY_SUCCESS
        : LOCAL_DEV_UI_MESSAGE_SEND_TYPES.DEPLOY_FAILURE,
      data: {
        latestBuild: this.localDevProcess.projectData.latestBuild,
        deployedBuild: this.localDevProcess.projectData.deployedBuild,
        latestDeployId: deployId,
      },
    });
  }

  private async handleAppInstallSuccess(): Promise<void> {
    this.localDevProcess.sendDevServerMessage(
      LOCAL_DEV_SERVER_MESSAGE_TYPES.STATIC_AUTH_APP_INSTALL_SUCCESS
    );
  }

  private async handleAppInstallFailure(): Promise<void> {
    this.localDevProcess.sendDevServerMessage(
      LOCAL_DEV_SERVER_MESSAGE_TYPES.STATIC_AUTH_APP_INSTALL_FAILURE
    );
  }

  private async handleAppInstallInitiated(): Promise<void> {
    this.localDevProcess.sendDevServerMessage(
      LOCAL_DEV_SERVER_MESSAGE_TYPES.OAUTH_APP_INSTALL_INITIATED
    );
  }

  private handleMessage(
    websocket: WebSocket,
    message: CLIWebSocketMessage
  ): boolean {
    if (isUploadWebsocketMessage(message)) {
      this.handleUpload(websocket);
      return true;
    } else if (isDeployWebsocketMessage(message)) {
      this.handleDeploy(websocket, message.data.force);
      return true;
    } else if (isViewedWelcomeScreenWebsocketMessage(message)) {
      addLocalStateFlag(CONFIG_LOCAL_STATE_FLAGS.LOCAL_DEV_UI_WELCOME);
      return true;
    } else if (isAppInstallSuccessWebsocketMessage(message)) {
      this.handleAppInstallSuccess();
      return true;
    } else if (isAppInstallFailureWebsocketMessage(message)) {
      this.handleAppInstallFailure();
      return true;
    } else if (isAppInstallInitiatedWebsocketMessage(message)) {
      this.handleAppInstallInitiated();
      return true;
    }

    return false;
  }

  private sendProjectData(websocket: WebSocket): void {
    this.cliWebSocketServer.sendMessage(websocket, {
      type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_DATA,
      data: {
        projectName: this.localDevProcess.projectData.name,
        projectId: this.localDevProcess.projectData.id,
        latestBuild: this.localDevProcess.projectData.latestBuild,
        deployedBuild: this.localDevProcess.projectData.deployedBuild,
        targetProjectAccountId: this.localDevProcess.targetProjectAccountId,
        targetTestingAccountId: this.localDevProcess.targetTestingAccountId,
      },
    });
  }

  private setupProjectNodesListener(websocket: WebSocket) {
    const listener = (nodes: {
      [key: string]: IntermediateRepresentationNodeLocalDev;
    }) => {
      this.cliWebSocketServer.sendMessage(websocket, {
        type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_NODES,
        data: nodes,
      });
    };

    this.localDevProcess.addStateListener('projectNodes', listener);

    websocket.on('close', () => {
      this.localDevProcess.removeStateListener('projectNodes', listener);
    });
  }

  private setupAppDataListener(websocket: WebSocket) {
    const listener = (appData: Record<string, AppLocalDevData>) => {
      this.cliWebSocketServer.sendMessage(websocket, {
        type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_APP_DATA,
        data: appData,
      });
    };

    this.localDevProcess.addStateListener('appData', listener);

    websocket.on('close', () => {
      this.localDevProcess.removeStateListener('appData', listener);
    });
  }

  private setupUploadWarningsListener(websocket: WebSocket) {
    const listener = (uploadWarnings: Set<string>) => {
      const formattedUploadWarnings =
        Array.from(uploadWarnings).map(removeAnsiCodes);

      this.cliWebSocketServer.sendMessage(websocket, {
        type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_UPLOAD_WARNINGS,
        data: { uploadWarnings: formattedUploadWarnings },
      });
    };

    this.localDevProcess.addStateListener('uploadWarnings', listener);

    websocket.on('close', () => {
      this.localDevProcess.removeStateListener('uploadWarnings', listener);
    });
  }

  private setupDevServersStartedListener(websocket: WebSocket) {
    const listener = (devServersStarted: boolean) => {
      if (devServersStarted) {
        this.cliWebSocketServer.sendMessage(websocket, {
          type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.DEV_SERVERS_STARTED,
        });
      }
    };

    this.localDevProcess.addStateListener('devServersStarted', listener);

    websocket.on('close', () => {
      this.localDevProcess.removeStateListener('devServersStarted', listener);
    });
  }

  private setupStateListeners(websocket: WebSocket) {
    this.setupProjectNodesListener(websocket);
    this.setupAppDataListener(websocket);
    this.setupUploadWarningsListener(websocket);
    this.setupDevServersStartedListener(websocket);
  }

  async start(): Promise<void> {
    return this.cliWebSocketServer.start({
      metadata: {
        localDevWebsocketServerVersion: LOCAL_DEV_WEBSOCKET_SERVER_VERSION,
      },
      onConnection: ws => {
        this.sendProjectData(ws);
        this.setupStateListeners(ws);
        this.localDevProcess.sendDevServerMessage(
          LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
        );
      },
      onMessage: (ws, message) => this.handleMessage(ws, message),
    });
  }

  shutdown() {
    this.cliWebSocketServer.shutdown();
  }
}

export default LocalDevWebsocketServer;
