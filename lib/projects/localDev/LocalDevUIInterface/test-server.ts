import { startPortManagerServer } from '@hubspot/local-dev-lib/portManager';
import LocalDevUIWebsocketServer from './LocalDevUIWebsocketServer';

async function main() {
  await startPortManagerServer();
  LocalDevUIWebsocketServer.init();
}

main();
