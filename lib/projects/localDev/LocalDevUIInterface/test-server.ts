import { startPortManagerServer } from '@hubspot/local-dev-lib/portManager';
import LocalDevUIWebsocketServer from './LocalDevUIWebsocketServer';

startPortManagerServer().then(() => {
  LocalDevUIWebsocketServer.init();
});
