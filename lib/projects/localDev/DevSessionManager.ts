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
import { ExitFunction } from '../../../types/Yargs.js';

type DevSessionManagerConstructorOptions = {
  targetTestingAccountId: number;
  localDevLogger?: LocalDevLogger;
  exit: ExitFunction;
};

class DevSessionManager {
  localDevLogger?: LocalDevLogger;
  targetTestingAccountId: number;
  protected devSessionId: number | undefined;
  private heartbeatInterval: NodeJS.Timeout | undefined;
  private heartbeatRetries: number;
  private exit: ExitFunction;

  constructor(options: DevSessionManagerConstructorOptions) {
    this.targetTestingAccountId = options.targetTestingAccountId;
    this.localDevLogger = options.localDevLogger;
    this.exit = options.exit;
    this.devSessionId = undefined;
    this.heartbeatInterval = undefined;
    this.heartbeatRetries = 0;
  }

  private validateSessionIdExists(): asserts this is this & {
    devSessionId: number;
  } {
    if (!this.devSessionId) {
      if (this.localDevLogger) {
        this.localDevLogger.devSessionMissingSessionIdError();
      } else {
        // Fallback for deprecated local dev manager
        uiLogger.error(lib.LocalDevManager.devSession.missingSessionIdError);
      }
      throw new Error(lib.LocalDevManager.devSession.missingSessionIdError);
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
      this.devSessionId = registerDevSessionResponse.data.sessionId;
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

    try {
      this.validateSessionIdExists();
    } catch {
      return this.exit(EXIT_CODES.ERROR);
    }

    this.initializeHeartbeat();
    return true;
  }

  private initializeHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        this.validateSessionIdExists();
      } catch {
        return this.exit(EXIT_CODES.ERROR);
      }

      try {
        await devSessionHeartbeat(
          this.targetTestingAccountId,
          this.devSessionId
        );
      } catch (e) {
        if (this.heartbeatRetries < 3) {
          this.heartbeatRetries++;
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
        return this.exit(EXIT_CODES.ERROR);
      }
    }, 30000);
  }

  async deleteDevSession(): Promise<boolean> {
    if (this.devSessionId) {
      clearInterval(this.heartbeatInterval);

      try {
        await deleteDevSession(this.targetTestingAccountId, this.devSessionId);
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
