import { LocalDevUIWebsocketMessage } from '../../../../../types/LocalDevUIInterface';
import { LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES } from '../../../../constants';

export function handleWebsocketMessage(
  message: LocalDevUIWebsocketMessage
): void {
  switch (message.type) {
    case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.UPLOAD:
      console.log('run upload');
      break;
    case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.INSTALL_DEPS:
      console.log('run install deps');
      break;
    case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.APP_INSTALLED:
      console.log('app installed');
      break;
    default:
      console.log(
        '@TODO Unsupported message received. Unknown message type:',
        message.type
      );
  }
}
