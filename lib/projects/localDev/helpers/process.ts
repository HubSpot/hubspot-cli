import { LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID } from '../../../constants.js';
import { EXIT_CODES } from '../../../enums/exitCodes.js';
import { getServerPortByInstanceId } from '@hubspot/local-dev-lib/portManager';
import { uiLogger } from '../../../ui/logger.js';
import { commands } from '../../../../lang/en.js';

export async function confirmLocalDevIsNotRunning(): Promise<void> {
  try {
    await getServerPortByInstanceId(LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID);

    uiLogger.error(commands.project.dev.errors.localDevAlreadyRunning);

    process.exit(EXIT_CODES.ERROR);
  } catch (error) {
    return;
  }
}
