import { LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID } from '../../../constants.js';
import { getServerPortByInstanceId } from '@hubspot/local-dev-lib/portManager';

export async function isLocalDevRunning(): Promise<boolean> {
  try {
    const existingPortInUse = await getServerPortByInstanceId(
      LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID
    );
    return Boolean(existingPortInUse);
  } catch {
    return false;
  }
}
