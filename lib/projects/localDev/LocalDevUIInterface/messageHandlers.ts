import { LocalDevUIWebsocketMessage } from '../../../../types/LocalDevUIInterface';

export function handleWebsocketMessage(
  message: LocalDevUIWebsocketMessage
): void {
  console.log(message);
}
