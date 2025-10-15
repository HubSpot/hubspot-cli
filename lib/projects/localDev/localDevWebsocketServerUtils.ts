import {
  LocalDevDeployWebsocketMessage,
  LocalDevWebsocketMessage,
} from '../../../types/LocalDev.js';
import { LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES } from '../../constants.js';

export function isUploadWebsocketMessage(message: LocalDevWebsocketMessage) {
  return message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.UPLOAD;
}

export function isDeployWebsocketMessage(
  message: LocalDevWebsocketMessage
): message is LocalDevDeployWebsocketMessage {
  return message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.DEPLOY;
}

export function isViewedWelcomeScreenWebsocketMessage(
  message: LocalDevWebsocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.VIEWED_WELCOME_SCREEN
  );
}

export function isAppInstallSuccessWebsocketMessage(
  message: LocalDevWebsocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.APP_INSTALL_SUCCESS
  );
}

export function isAppInstallInitiatedWebsocketMessage(
  message: LocalDevWebsocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.APP_INSTALL_INITIATED
  );
}

export function isAppInstallFailureWebsocketMessage(
  message: LocalDevWebsocketMessage
) {
  return (
    message.type === LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.APP_INSTALL_FAILURE
  );
}
