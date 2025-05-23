import { getAccountId } from '@hubspot/local-dev-lib/config';
import { getConfigDefaultAccount } from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';

import { uiLogger } from '../../ui/logger';
import {
  uiBetaTag,
  uiLine,
  uiAccountDescription,
  uiCommandReference,
} from '../../ui';
import { lib } from '../../../lang/en';
import LocalDevState from './LocalDevState';
import SpinniesManager from '../../ui/SpinniesManager';
import { logError } from '../../errorHandlers';

class LocalDevLogger {
  private state: LocalDevState;
  private mostRecentUploadWarning: string | null;
  private uploadWarnings: Set<string>;

  constructor(state: LocalDevState) {
    this.state = state;
    this.mostRecentUploadWarning = null;
    this.uploadWarnings = new Set();
  }

  private logUploadInstructions(warning: string): void {
    uiLogger.log('');
    uiLogger.warn(warning);
    uiLogger.log('');
    uiLogger.log(lib.LocalDevManager.uploadWarning.instructionsHeader);

    uiLogger.log(lib.LocalDevManager.uploadWarning.stopDev);
    if (this.state.isGithubLinked) {
      uiLogger.log(lib.LocalDevManager.uploadWarning.pushToGithub);
    } else {
      uiLogger.log(
        lib.LocalDevManager.uploadWarning.runUpload(this.getUploadCommand())
      );
    }
    uiLogger.log(lib.LocalDevManager.uploadWarning.restartDev);
  }

  private handleError(
    e: unknown,
    langFunction: (message: string) => string
  ): void {
    if (this.state.debug) {
      logger.error(e);
    }
    uiLogger.error(langFunction(e instanceof Error ? e.message : ''));
  }

  getUploadCommand(): string {
    const currentDefaultAccount = getConfigDefaultAccount() || undefined;

    return this.state.targetProjectAccountId !==
      getAccountId(currentDefaultAccount)
      ? uiCommandReference(
          `hs project upload --account=${this.state.targetProjectAccountId}`
        )
      : uiCommandReference('hs project upload');
  }

  uploadWarning(): void {
    // At the moment, there is only one additional warning. We may need to do this in a
    // more robust way in the future
    const additionalWarnings = Array.from(this.uploadWarnings).join('\n\n');
    const warning = `${lib.LocalDevManager.uploadWarning.defaultWarning} ${additionalWarnings}`;

    // Avoid logging the warning to the console if it is currently the most
    // recently logged warning. We do not want to spam the console with the same message.
    if (warning !== this.mostRecentUploadWarning) {
      this.logUploadInstructions(warning);

      this.mostRecentUploadWarning = warning;
    }
  }

  addUploadWarning(warning: string): void {
    this.uploadWarnings.add(warning);
  }

  clearUploadWarnings(): void {
    this.uploadWarnings.clear();
  }

  missingComponentsWarning(components: string[]): void {
    const warning = lib.LocalDevManager.uploadWarning.missingComponents(
      components.join(', ')
    );

    if (warning !== this.mostRecentUploadWarning) {
      this.logUploadInstructions(warning);
      this.mostRecentUploadWarning = warning;
    }
  }

  fileChangeError(e: unknown): void {
    this.handleError(e, lib.LocalDevManager.devServer.fileChangeError);
  }

  devServerSetupError(e: unknown): void {
    this.handleError(e, lib.LocalDevManager.devServer.setupError);
  }

  devServerStartError(e: unknown): void {
    this.handleError(e, lib.LocalDevManager.devServer.startError);
  }

  devServerCleanupError(e: unknown): void {
    this.handleError(e, lib.LocalDevManager.devServer.cleanupError);
  }

  noDeployedBuild(): void {
    uiLogger.error(
      lib.LocalDevManager.noDeployedBuild(
        this.state.projectConfig.name,
        uiAccountDescription(this.state.targetProjectAccountId),
        this.getUploadCommand()
      )
    );
    uiLogger.log('');
  }

  resetSpinnies(): void {
    SpinniesManager.stopAll();
    SpinniesManager.init();
  }

  startupMessage(): void {
    if (!this.state.debug) {
      console.clear();
    }

    uiBetaTag(lib.LocalDevManager.betaMessage);

    uiLogger.log(lib.LocalDevManager.learnMoreLocalDevServer);

    uiLogger.log('');
    uiLogger.log(
      lib.LocalDevManager.running(
        this.state.projectConfig.name,
        uiAccountDescription(this.state.targetProjectAccountId)
      )
    );
    uiLogger.log(
      lib.LocalDevManager.viewProjectLink(
        this.state.projectConfig.name,
        this.state.targetProjectAccountId
      )
    );

    uiLogger.log('');
    uiLogger.log(lib.LocalDevManager.quitHelper);
    uiLine();
    uiLogger.log('');
  }

  cleanupStart(): void {
    SpinniesManager.add('cleanupMessage', {
      text: lib.LocalDevManager.exitingStart,
    });
  }

  cleanupError(): void {
    SpinniesManager.fail('cleanupMessage', {
      text: lib.LocalDevManager.exitingFail,
    });
  }

  cleanupSuccess(): void {
    SpinniesManager.succeed('cleanupMessage', {
      text: lib.LocalDevManager.exitingSucceed,
    });
  }

  uploadInitiated(): void {
    uiLogger.log(lib.LocalDevProcess.uploadInitiated);
  }

  projectConfigMismatch(): void {
    uiLogger.log(lib.LocalDevProcess.projectConfigMismatch);
  }

  uploadError(error: unknown): void {
    logger.log('');
    logError(error);
    uiLogger.log(lib.LocalDevProcess.uploadFailed);
    logger.log('');
  }

  uploadSuccess(): void {
    logger.log('');
    uiLogger.log(lib.LocalDevProcess.uploadSuccess);
    uiLine();
    logger.log('');
  }

  monitorConsoleOutput(): void {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    type StdoutCallback = (err?: Error | null) => void;

    // Need to provide both overloads for process.stdout.write to satisfy TS
    function customStdoutWrite(
      this: LocalDevLogger,
      buffer: Uint8Array | string,
      cb?: StdoutCallback
    ): boolean;
    function customStdoutWrite(
      this: LocalDevLogger,
      str: Uint8Array | string,
      encoding?: BufferEncoding,
      cb?: StdoutCallback
    ): boolean;
    function customStdoutWrite(
      this: LocalDevLogger,
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | StdoutCallback,
      callback?: StdoutCallback
    ) {
      // Reset the most recently logged warning
      if (this.mostRecentUploadWarning) {
        this.mostRecentUploadWarning = null;
      }

      if (typeof encoding === 'function') {
        return originalStdoutWrite(chunk, callback);
      }
      return originalStdoutWrite(chunk, encoding, callback);
    }

    customStdoutWrite.bind(this);

    process.stdout.write = customStdoutWrite;
  }
}

export default LocalDevLogger;
