import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { addLocalStateFlag } from '@hubspot/local-dev-lib/config';
import {
  LOCAL_DEV_UI_MESSAGE_SEND_TYPES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
  CONFIG_LOCAL_STATE_FLAGS,
} from '../../constants.js';
import {
  AppLocalDevData,
  LocalDevWebsocketMessage,
} from '../../../types/LocalDev.js';
import LocalDevProcess from './LocalDevProcess.js';
import { lib } from '../../../lang/en.js';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib';
import { removeAnsiCodes } from '../../ui/removeAnsiCodes.js';
import {
  isDeployWebsocketMessage,
  isViewedWelcomeScreenWebsocketMessage,
  isUploadWebsocketMessage,
} from './localDevWebsocketServerUtils.js';
import pkg from '../../../package.json' with { type: 'json' };

const SERVER_INSTANCE_ID = 'local-dev-ui-websocket-server';
const LOCAL_DEV_WEBSOCKET_SERVER_VERSION = 1;

const LOG_PREFIX = '[LocalDevWebsocketServer]';

const DOMAINS = ['hubspot.com', 'hubspotqa.com'];
const SUBDOMAINS = ['local', 'app', 'app-na2', 'app-na3', 'app-ap1', 'app-eu1'];
const ALLOWED_ORIGIN_REGEX = new RegExp(
  `^https://(${SUBDOMAINS.join('|')})\\.(${DOMAINS.join('|')})$`
);

class LocalDevWebsocketServer {
  private server?: WebSocketServer;
  private debug?: boolean;
  private localDevProcess: LocalDevProcess;

  constructor(localDevProcess: LocalDevProcess, debug?: boolean) {
    this.localDevProcess = localDevProcess;
    this.debug = debug;
  }

  private log(message: string): void {
    if (this.debug) {
      logger.log(LOG_PREFIX, message);
    }
  }

  private logError(message: string): void {
    if (this.debug) {
      logger.error(LOG_PREFIX, message);
    }
  }

  private sendMessage(
    websocket: WebSocket,
    message: LocalDevWebsocketMessage
  ): void {
    websocket.send(JSON.stringify(message));
  }

  private async handleUpload(websocket: WebSocket): Promise<void> {
    const { uploadSuccess, buildSuccess, deploySuccess, deployId } =
      await this.localDevProcess.uploadProject();

    this.sendMessage(websocket, {
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

    this.sendMessage(websocket, {
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

  private setupMessageHandlers(websocket: WebSocket): void {
    websocket.on('message', data => {
      try {
        const message: LocalDevWebsocketMessage = JSON.parse(data.toString());

        if (!message.type) {
          this.logError(
            lib.LocalDevWebsocketServer.errors.missingTypeField(data.toString())
          );
          return;
        }

        if (isUploadWebsocketMessage(message)) {
          this.handleUpload(websocket);
        } else if (isDeployWebsocketMessage(message)) {
          this.handleDeploy(websocket, message.data.force);
        } else if (isViewedWelcomeScreenWebsocketMessage(message)) {
          addLocalStateFlag(CONFIG_LOCAL_STATE_FLAGS.LOCAL_DEV_UI_WELCOME);
        } else {
          this.logError(
            lib.LocalDevWebsocketServer.errors.unknownMessageType(message.type)
          );
        }
      } catch (e) {
        this.logError(
          lib.LocalDevWebsocketServer.errors.invalidJSON(data.toString())
        );
      }
    });
  }

  private sendCliMetadata(websocket: WebSocket): void {
    this.sendMessage(websocket, {
      type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.CLI_METADATA,
      data: {
        cliVersion: pkg.version,
        localDevWebsocketServerVersion: LOCAL_DEV_WEBSOCKET_SERVER_VERSION,
      },
    });
  }

  private sendProjectData(websocket: WebSocket): void {
    this.sendMessage(websocket, {
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
      this.sendMessage(websocket, {
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
      this.sendMessage(websocket, {
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

      this.sendMessage(websocket, {
        type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_UPLOAD_WARNINGS,
        data: { uploadWarnings: formattedUploadWarnings },
      });
    };

    this.localDevProcess.addStateListener('uploadWarnings', listener);

    websocket.on('close', () => {
      this.localDevProcess.removeStateListener('uploadWarnings', listener);
    });
  }

  private setupStateListeners(websocket: WebSocket) {
    this.setupProjectNodesListener(websocket);
    this.setupAppDataListener(websocket);
    this.setupUploadWarningsListener(websocket);
  }

  async start() {
    const portManagerIsRunning = await isPortManagerServerRunning();
    if (!portManagerIsRunning) {
      throw new Error(
        lib.LocalDevWebsocketServer.errors.portManagerNotRunning(LOG_PREFIX)
      );
    }

    const portData = await requestPorts([{ instanceId: SERVER_INSTANCE_ID }]);
    const port = portData[SERVER_INSTANCE_ID];

    this.server = new WebSocketServer({ port });

    this.log(lib.LocalDevWebsocketServer.logs.startup(port));
    this.server.on('connection', (ws, req) => {
      const origin = req.headers.origin;
      if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) {
        ws.close(
          1008,
          lib.LocalDevWebsocketServer.errors.originNotAllowed(origin)
        );
        return;
      }

      this.sendCliMetadata(ws);
      this.sendProjectData(ws);

      this.setupMessageHandlers(ws);
      this.setupStateListeners(ws);

      this.localDevProcess.sendDevServerMessage(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
      );
    });

    this.server.on('close', () => {});
  }

  shutdown() {
    this.server?.close();
    this.server = undefined;
  }
}

export default LocalDevWebsocketServer;
