import { ArgumentsCamelCase } from 'yargs';
import { getConfig } from '@hubspot/local-dev-lib/config';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { STATE_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { trackCommandUsage as _trackCommandUsage } from '../usageTracking.js';
import { pkg } from '../jsonLoader.js';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';
import {
  CommonArgs,
  ExitCode,
  JSONOutputArgs,
  UsageTrackingArgs,
  UsageTrackingMetaWithAccountId,
} from '../../types/Yargs.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { isPromptExitError } from '../errors/PromptExitError.js';
import { debugError } from '../errorHandlers/index.js';

function logUsageTrackingMessage(isJsonOutput: boolean): void {
  if (isJsonOutput) {
    return;
  }

  try {
    const config = getConfig();
    if (config?.allowUsageTracking !== true) {
      return;
    }

    const lastShownVersion = getStateValue(
      STATE_FLAGS.USAGE_TRACKING_MESSAGE_LAST_SHOW_VERSION
    );

    if (lastShownVersion === pkg.version) {
      return;
    }

    setStateValue(
      STATE_FLAGS.USAGE_TRACKING_MESSAGE_LAST_SHOW_VERSION,
      pkg.version
    );
    uiLogger.info(lib.usageTracking.transparencyMessage);
  } catch (_e) {
    return;
  }
}

export function makeYargsHandlerWithUsageTracking<T extends CommonArgs>(
  trackingName: string,
  handler: (args: ArgumentsCamelCase<T>) => Promise<void>
): (args: ArgumentsCamelCase<T>) => Promise<void> {
  return async (args: ArgumentsCamelCase<T>) => {
    const meta: UsageTrackingMetaWithAccountId = {};
    let trackingFired = false;

    const trackingArgs = args as ArgumentsCamelCase<T> & UsageTrackingArgs;

    const addUsageMetadata = (newMeta: UsageTrackingMetaWithAccountId) => {
      Object.assign(meta, newMeta);
    };
    trackingArgs.addUsageMetadata = addUsageMetadata;

    const trackCommandUsage = async (successful: boolean) => {
      if (trackingFired) {
        return;
      }
      trackingFired = true;

      try {
        const { accountId: overrideAccountId, ...trackingMeta } = meta;
        trackingMeta.successful = successful;

        await _trackCommandUsage(
          trackingName,
          trackingMeta,
          overrideAccountId ?? args.derivedAccountId
        );
      } catch (_e) {}
    };

    const onForcedExit = () => {
      process.exit(EXIT_CODES.SUCCESS);
    };

    const onSigint = async () => {
      process.removeListener('SIGINT', onSigint);
      process.on('SIGINT', onForcedExit);
      try {
        await trackCommandUsage(false);
      } catch (_e) {}
      process.removeListener('SIGINT', onForcedExit);
      process.exit(EXIT_CODES.SUCCESS);
    };
    process.on('SIGINT', onSigint);

    const trackCommandUsageAndRemoveListeners = async (successful: boolean) => {
      await trackCommandUsage(successful);
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGINT', onForcedExit);
    };

    trackingArgs.exit = async (code: ExitCode): Promise<never> => {
      await trackCommandUsageAndRemoveListeners(code !== EXIT_CODES.ERROR);
      return process.exit(code);
    };

    const jsonArgs = args as ArgumentsCamelCase<T & JSONOutputArgs>;
    logUsageTrackingMessage(
      Boolean(jsonArgs.json || jsonArgs.formatOutputAsJson)
    );

    try {
      await handler(trackingArgs);
    } catch (e) {
      const isSuccessfulPromptExit = isPromptExitError(e)
        ? e.exitCode !== EXIT_CODES.ERROR
        : false;
      await trackCommandUsageAndRemoveListeners(isSuccessfulPromptExit);

      if (isPromptExitError(e)) {
        return process.exit(e.exitCode);
      } else {
        debugError(e);
        return process.exit(EXIT_CODES.ERROR);
      }
    }

    await trackCommandUsageAndRemoveListeners(true);
  };
}
