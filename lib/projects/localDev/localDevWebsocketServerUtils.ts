import { LocalDevDeployWebsocketMessage } from '../../../types/LocalDev.js';
import { LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES } from '../../constants.js';
import { CLIWebSocketMessage } from '../../CLIWebSocketServer.js';

export function isUploadWebsocketMessage(message: CLIWebSocketMessage) {
  return message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.UPLOAD;
}

export function isDeployWebsocketMessage(
  message: CLIWebSocketMessage
): message is LocalDevDeployWebsocketMessage {
  return message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.DEPLOY;
}

export function isViewedWelcomeScreenWebsocketMessage(
  message: CLIWebSocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.VIEWED_WELCOME_SCREEN
  );
}

export function isAppInstallSuccessWebsocketMessage(
  message: CLIWebSocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.APP_INSTALL_SUCCESS
  );
}

export function isAppInstallInitiatedWebsocketMessage(
  message: CLIWebSocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.APP_INSTALL_INITIATED
  );
}

export function isAppInstallFailureWebsocketMessage(
  message: CLIWebSocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.APP_INSTALL_FAILURE
  );
}
