import { getActiveServers } from '@hubspot/local-dev-lib/portManager';
import LocalDevLogger from './LocalDevLogger.js';
import {
  devSessionHeartbeat,
  registerDevSession,
  deleteDevSession,
} from './helpers/devSessionsApi.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';
import { getErrorMessage } from '../../errorHandlers/index.js';

type DevSessionManagerConstructorOptions = {
  targetTestingAccountId: number;
  localDevLogger?: LocalDevLogger;
};

class DevSessionManager {
  localDevLogger?: LocalDevLogger;
  targetTestingAccountId: number;
  protected _devSessionId: number | undefined;
  private _heartbeatInterval: NodeJS.Timeout | undefined;
  private _heartbeatRetries: number;

  constructor(options: DevSessionManagerConstructorOptions) {
    this.targetTestingAccountId = options.targetTestingAccountId;
    this.localDevLogger = options.localDevLogger;
    this._devSessionId = undefined;
    this._heartbeatInterval = undefined;
    this._heartbeatRetries = 0;
  }

  private validateSessionIdExists(): asserts this is this & {
    _devSessionId: number;
  } {
    if (!this._devSessionId) {
      if (this.localDevLogger) {
        this.localDevLogger.devSessionMissingSessionIdError();
      } else {
        // Fallback for deprecated local dev manager
        uiLogger.error(lib.LocalDevManager.devSession.missingSessionIdError);
      }
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async registerSession(): Promise<boolean> {
    try {
      const activeServers = await getActiveServers();

      const portData = Object.entries(activeServers).map(
        ([serverId, port]) => ({ serverId, port })
      );

      const registerDevSessionResponse = await registerDevSession(
        this.targetTestingAccountId,
        portData
      );
      this._devSessionId = registerDevSessionResponse.data.sessionId;
    } catch (e) {
      if (this.localDevLogger) {
        this.localDevLogger.devSessionRegistrationError(e);
      } else {
        // Fallback for deprecated local dev manager
        uiLogger.error(
          lib.LocalDevManager.devSession.registrationError(getErrorMessage(e))
        );
      }
      return false;
    }

    this.validateSessionIdExists();

    this.initializeHeartbeat();
    return true;
  }

  private initializeHeartbeat(): void {
    this._heartbeatInterval = setInterval(async () => {
      this.validateSessionIdExists();

      try {
        await devSessionHeartbeat(
          this.targetTestingAccountId,
          this._devSessionId
        );
      } catch (e) {
        if (this._heartbeatRetries < 3) {
          this._heartbeatRetries++;
          return;
        }

        if (this.localDevLogger) {
          this.localDevLogger.devSessionHeartbeatError(e);
        } else {
          // Fallback for deprecated local dev manager
          uiLogger.error(
            lib.LocalDevManager.devSession.heartbeatError(getErrorMessage(e))
          );
        }
        process.exit(EXIT_CODES.ERROR);
      }
    }, 30000);
  }

  async deleteDevSession(): Promise<boolean> {
    if (this._devSessionId) {
      clearInterval(this._heartbeatInterval);

      try {
        await deleteDevSession(this.targetTestingAccountId, this._devSessionId);
      } catch (e) {
        if (this.localDevLogger) {
          this.localDevLogger.devSessionDeletionError(e);
        } else {
          // Fallback for deprecated local dev manager
          uiLogger.error(
            lib.LocalDevManager.devSession.deletionError(getErrorMessage(e))
          );
        }
        return false;
      }
    }

    return true;
  }
}

export default DevSessionManager;
