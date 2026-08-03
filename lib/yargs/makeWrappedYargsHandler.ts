import os from 'os';
import path from 'path';
import { ArgumentsCamelCase } from 'yargs';
import { z } from 'zod';
import { getConfig } from '@hubspot/local-dev-lib/config';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { STATE_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { logger as ldlLogger } from '@hubspot/local-dev-lib/logger';
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
import { MAX_LOG_FILES } from '../constants.js';

export type WrappedHandlerOptions = {
  jsonOutputSchema?: z.ZodType;
};

const HANDLER_LOG_DIR = path.join(os.homedir(), '.hscli', 'logs', 'cli');

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

function createUsageTracker(
  trackingName: string,
  derivedAccountId: number | undefined
) {
  const startTime = Date.now();
  const meta: UsageTrackingMetaWithAccountId = {};
  let fired = false;

  const addMetadata = (newMeta: UsageTrackingMetaWithAccountId) => {
    Object.assign(meta, newMeta);
  };

  const track = async (successful: boolean) => {
    if (fired) {
      return;
    }
    fired = true;

    try {
      const { accountId: overrideAccountId, ...trackingMeta } = meta;
      trackingMeta.successful = successful;
      trackingMeta.executionTime = Date.now() - startTime;

      await _trackCommandUsage(
        trackingName,
        trackingMeta,
        overrideAccountId ?? derivedAccountId
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
      await track(false);
    } catch (_e) {}
    process.removeListener('SIGINT', onForcedExit);
    process.exit(EXIT_CODES.SUCCESS);
  };
  process.on('SIGINT', onSigint);

  const trackAndCleanup = async (successful: boolean) => {
    await track(successful);
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGINT', onForcedExit);
  };

  return { addMetadata, trackAndCleanup };
}

function createJsonOutputManager(isJsonOutput: boolean, schema?: z.ZodType) {
  const data: Record<string, unknown> = {};
  let emitted = false;

  const add = (newData: Record<string, unknown>) => {
    Object.assign(data, newData);
  };

  const emit = (): boolean => {
    if (!emitted && isJsonOutput && Object.keys(data).length > 0) {
      emitted = true;
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          uiLogger.json(data);
          uiLogger.warn(lib.jsonSchema.validationFailed);
          return false;
        }
      }
      uiLogger.json(data);
    }
    return true;
  };

  return { add, emit };
}

function createLogFileWriter(trackingName: string, isJsonOutput: boolean) {
  const writeLogFile = (): string | null => {
    if (isJsonOutput) {
      return null;
    }
    return ldlLogger.writeBufferedLogsToFile({
      dir: HANDLER_LOG_DIR,
      filenamePrefix: trackingName,
      maxFiles: MAX_LOG_FILES,
    });
  };

  const writeFailureLogFile = (): void => {
    const savedPath = writeLogFile();
    if (savedPath) {
      uiLogger.log('');
      uiLogger.error(lib.handlerLogFile.saved(savedPath));
    }
  };

  return { writeLogFile, writeFailureLogFile };
}

export function makeWrappedYargsHandler<T extends CommonArgs>(
  trackingName: string,
  handler: (args: ArgumentsCamelCase<T>) => Promise<void>,
  options?: WrappedHandlerOptions
): (args: ArgumentsCamelCase<T>) => Promise<void> {
  return async (args: ArgumentsCamelCase<T>) => {
    const wrappedHandlerArgs = args as ArgumentsCamelCase<T> &
      UsageTrackingArgs &
      JSONOutputArgs<Record<string, unknown>>;

    const isJsonOutput = Boolean(
      wrappedHandlerArgs.json || wrappedHandlerArgs.formatOutputAsJson
    );
    const schema = options?.jsonOutputSchema;

    const tracker = createUsageTracker(trackingName, args.derivedAccountId);

    if (wrappedHandlerArgs.jsonSchema) {
      if (schema) {
        uiLogger.json(z.toJSONSchema(schema));
      } else {
        uiLogger.json({ error: lib.jsonSchema.noSchemaForCommand });
      }
      await tracker.trackAndCleanup(true);
      return process.exit(EXIT_CODES.SUCCESS);
    }
    const json = createJsonOutputManager(isJsonOutput, schema);
    const logs = createLogFileWriter(trackingName, isJsonOutput);

    wrappedHandlerArgs.addUsageMetadata = tracker.addMetadata;
    wrappedHandlerArgs.addJsonOutput = json.add;

    wrappedHandlerArgs.exit = async (code: ExitCode): Promise<never> => {
      const jsonValid = json.emit();
      const exitCode =
        !jsonValid && code === EXIT_CODES.SUCCESS ? EXIT_CODES.WARNING : code;
      await tracker.trackAndCleanup(exitCode !== EXIT_CODES.ERROR);
      if (exitCode === EXIT_CODES.ERROR) {
        logs.writeFailureLogFile();
      } else {
        logs.writeLogFile();
      }
      return process.exit(exitCode);
    };

    logUsageTrackingMessage(isJsonOutput);

    try {
      await handler(wrappedHandlerArgs);
    } catch (e) {
      const isSuccessfulPromptExit = isPromptExitError(e)
        ? e.exitCode !== EXIT_CODES.ERROR
        : false;
      await tracker.trackAndCleanup(isSuccessfulPromptExit);

      if (isPromptExitError(e)) {
        logs.writeLogFile();
        return process.exit(e.exitCode);
      } else {
        debugError(e);
        logs.writeFailureLogFile();
        return process.exit(EXIT_CODES.ERROR);
      }
    }

    const jsonValid = json.emit();
    await tracker.trackAndCleanup(true);
    logs.writeLogFile();
    if (!jsonValid) {
      return process.exit(EXIT_CODES.WARNING);
    }
  };
}
