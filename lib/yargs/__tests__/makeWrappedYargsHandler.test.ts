import { ArgumentsCamelCase } from 'yargs';
import { getConfig } from '@hubspot/local-dev-lib/config';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { STATE_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { logger as ldlLogger } from '@hubspot/local-dev-lib/logger';
import * as usageTrackingLib from '../../usageTracking.js';
import { makeWrappedYargsHandler } from '../../yargs/makeWrappedYargsHandler.js';
import { uiLogger } from '../../ui/logger.js';
import { pkg } from '../../jsonLoader.js';
import { lib } from '../../../lang/en.js';
import { CommonArgs, JSONOutputArgs } from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { Mock, Mocked } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/state');

const mockedGetConfig = getConfig as Mock;
const mockedGetStateValue = getStateValue as Mock;
const mockedSetStateValue = setStateValue as Mock;
const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;

const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const processExitSpy = vi.spyOn(process, 'exit');
const processOnSpy = vi.spyOn(process, 'on');
const processRemoveListenerSpy = vi.spyOn(process, 'removeListener');
const writeBufferedLogsToFileSpy = vi.spyOn(
  ldlLogger,
  'writeBufferedLogsToFile'
);

function makeArgs(
  overrides: Partial<ArgumentsCamelCase<CommonArgs>> = {}
): ArgumentsCamelCase<CommonArgs> {
  return {
    _: [],
    $0: 'hs',
    derivedAccountId: 12345,
    d: false,
    debug: false,
    ...overrides,
  } as ArgumentsCamelCase<CommonArgs>;
}

describe('makeWrappedYargsHandler', () => {
  beforeEach(() => {
    trackCommandUsageSpy.mockResolvedValue(undefined);
    processExitSpy.mockImplementation(() => undefined as never);
  });

  it('should fire tracking after successful handler completion', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: true, executionTime: expect.any(Number) },
      12345
    );
  });

  it('should fire tracking and exit on handler error', async () => {
    const error = new Error('handler failed');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: false, executionTime: expect.any(Number) },
      12345
    );
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });

  it('should fire tracking when exit is called with ERROR', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        await args.exit(EXIT_CODES.ERROR);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: false, executionTime: expect.any(Number) },
      12345
    );
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });

  it('should track successful=true when exit is called with SUCCESS', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: true, executionTime: expect.any(Number) },
      12345
    );
  });

  it('should track successful=true when exit is called with WARNING', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        await args.exit(EXIT_CODES.WARNING);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: true, executionTime: expect.any(Number) },
      12345
    );
  });

  it('should only fire tracking once even with multiple exit paths', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(trackCommandUsageSpy).toHaveBeenCalledTimes(1);
  });

  it('should accumulate metadata from multiple addUsageMetadata calls', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        args.addUsageMetadata({ action: 'upload' });
        args.addUsageMetadata({ step: 'validate' });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      {
        action: 'upload',
        step: 'validate',
        successful: true,
        executionTime: expect.any(Number),
      },
      12345
    );
  });

  it('should use accountId from metadata to override derivedAccountId', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        args.addUsageMetadata({ accountId: 99999 });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs({ derivedAccountId: 12345 }));

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: true, executionTime: expect.any(Number) },
      99999
    );
  });

  it('should fall back to derivedAccountId when no accountId override is set', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs({ derivedAccountId: 55555 }));

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: true, executionTime: expect.any(Number) },
      55555
    );
  });

  it('should not let tracking failure affect command execution', async () => {
    trackCommandUsageSpy.mockRejectedValue(new Error('tracking failed'));
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await expect(wrapped(makeArgs())).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should register a SIGINT listener and remove it after handler completes', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processRemoveListenerSpy).toHaveBeenCalledWith(
      'SIGINT',
      expect.any(Function)
    );
  });

  it('should remove SIGINT listener even when handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler failed'));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(processRemoveListenerSpy).toHaveBeenCalledWith(
      'SIGINT',
      expect.any(Function)
    );
  });

  it('should fire tracking with successful=false on SIGINT', async () => {
    const handler = vi.fn().mockImplementation(() => new Promise(() => {}));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    wrapped(makeArgs());

    const sigintCall = processOnSpy.mock.calls.find(
      call => call[0] === 'SIGINT'
    );
    expect(sigintCall).toBeDefined();

    const sigintHandler = sigintCall![1] as () => Promise<void>;
    await sigintHandler();

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: false, executionTime: expect.any(Number) },
      12345
    );
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('should allow a second Ctrl+C to force exit if tracking hangs', async () => {
    trackCommandUsageSpy.mockImplementation(() => new Promise(() => {}));

    const handler = vi.fn().mockImplementation(() => new Promise(() => {}));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    wrapped(makeArgs());

    const sigintCall = processOnSpy.mock.calls.find(
      call => call[0] === 'SIGINT'
    );
    expect(sigintCall).toBeDefined();

    const sigintHandler = sigintCall![1] as () => Promise<void>;
    sigintHandler();

    await vi.waitFor(() => {
      const forcedExitCall = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGINT' && call[1] !== sigintHandler
      );
      expect(forcedExitCall).toBeDefined();
    });

    const forcedExitCall = processOnSpy.mock.calls.find(
      call => call[0] === 'SIGINT' && call[1] !== sigintHandler
    );
    const forcedExitHandler = forcedExitCall![1] as () => void;
    forcedExitHandler();

    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('should track successful=true for PromptExitError with SUCCESS exitCode', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(
        new PromptExitError('User cancelled prompt', EXIT_CODES.SUCCESS)
      );
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: true, executionTime: expect.any(Number) },
      12345
    );
  });

  it('should track successful=false for PromptExitError with ERROR exitCode', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(
        new PromptExitError('No selectable choices', EXIT_CODES.ERROR)
      );
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      { successful: false, executionTime: expect.any(Number) },
      12345
    );
  });

  it('should catch non-PromptExitError errors and exit with ERROR', async () => {
    const error = new Error('some other error');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    expect(trackCommandUsageSpy).toHaveBeenCalledTimes(1);
  });

  it('should write a log file via LDL logger when the handler fails', async () => {
    writeBufferedLogsToFileSpy.mockReturnValue('/tmp/.hscli/logs/test.log');

    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(writeBufferedLogsToFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filenamePrefix: 'test-command',
        dir: expect.stringContaining('.hscli/logs'),
      })
    );
    expect(mockedUiLogger.error).toHaveBeenCalledWith(
      lib.handlerLogFile.saved('/tmp/.hscli/logs/test.log')
    );
  });

  it('should not announce a saved log path when writing the file fails', async () => {
    writeBufferedLogsToFileSpy.mockReturnValue(null);

    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(writeBufferedLogsToFileSpy).toHaveBeenCalled();
    expect(mockedUiLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Debug logs can be viewed at')
    );
  });

  it('should write a log file silently when handler completes successfully', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(writeBufferedLogsToFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filenamePrefix: 'test-command' })
    );
    expect(mockedUiLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Debug logs')
    );
  });

  it('should write a log file when the handler calls exit with ERROR', async () => {
    writeBufferedLogsToFileSpy.mockReturnValue('/tmp/.hscli/logs/test.log');

    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        await args.exit(EXIT_CODES.ERROR);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(writeBufferedLogsToFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filenamePrefix: 'test-command' })
    );
    expect(mockedUiLogger.error).toHaveBeenCalledWith(
      lib.handlerLogFile.saved('/tmp/.hscli/logs/test.log')
    );
  });

  it('should write a log file silently when exit is called with SUCCESS', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<CommonArgs>) => {
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(writeBufferedLogsToFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filenamePrefix: 'test-command' })
    );
    expect(mockedUiLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Debug logs')
    );
  });

  it('should write a log file silently for a successful PromptExitError', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(
        new PromptExitError('User cancelled prompt', EXIT_CODES.SUCCESS)
      );
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(writeBufferedLogsToFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filenamePrefix: 'test-command' })
    );
    expect(mockedUiLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Debug logs')
    );
  });

  it('should not write a log file when --json is set', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(writeBufferedLogsToFileSpy).not.toHaveBeenCalled();
    expect(mockedUiLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Debug logs can be viewed at')
    );
  });

  it('should not write a log file when --formatOutputAsJson is set', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ formatOutputAsJson: true } as Partial<
        ArgumentsCamelCase<CommonArgs>
      >)
    );

    expect(writeBufferedLogsToFileSpy).not.toHaveBeenCalled();
  });

  it('should not surface errors if tracking fails during SIGINT', async () => {
    trackCommandUsageSpy.mockRejectedValue(new Error('network failure'));

    const handler = vi.fn().mockImplementation(() => new Promise(() => {}));
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    wrapped(makeArgs());

    const sigintCall = processOnSpy.mock.calls.find(
      call => call[0] === 'SIGINT'
    );
    expect(sigintCall).toBeDefined();

    const sigintHandler = sigintCall![1] as () => Promise<void>;
    await sigintHandler();

    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

describe('addJsonOutput / emitJsonOutput', () => {
  type JsonArgs = CommonArgs & JSONOutputArgs;

  beforeEach(() => {
    trackCommandUsageSpy.mockResolvedValue(undefined);
    processExitSpy.mockImplementation(() => undefined as never);
  });

  it('should emit accumulated JSON data when exit is called with --json', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ buildId: 42 });
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({ buildId: 42 });
  });

  it('should emit accumulated JSON data on normal handler completion with --json', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ projectName: 'my-project' });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({
      projectName: 'my-project',
    });
  });

  it('should merge multiple addJsonOutput calls', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ buildId: 1 });
        args.addJsonOutput({ deployId: 2 });
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({
      buildId: 1,
      deployId: 2,
    });
  });

  it('should not emit JSON when --json is not set', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ buildId: 42 });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.json).not.toHaveBeenCalled();
  });

  it('should not emit JSON when no data was accumulated', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).not.toHaveBeenCalled();
  });

  it('should not emit JSON twice when exit is called and handler completes', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ buildId: 42 });
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledTimes(1);
  });

  it('should emit JSON with --formatOutputAsJson alias', async () => {
    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ status: 'ok' });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ formatOutputAsJson: true } as Partial<
        ArgumentsCamelCase<CommonArgs>
      >)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({ status: 'ok' });
  });
});

describe('--json-schema flag', () => {
  beforeEach(() => {
    trackCommandUsageSpy.mockResolvedValue(undefined);
    processExitSpy.mockImplementation(() => undefined as never);
  });

  it('should emit JSON Schema and exit when schema is defined', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string(), count: z.number() });

    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler, {
      jsonOutputSchema: schema,
    });

    await wrapped(
      makeArgs({ jsonSchema: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(handler).not.toHaveBeenCalled();
    expect(mockedUiLogger.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          name: { type: 'string' },
          count: { type: 'number' },
        }),
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('should emit error object when no schema is defined', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ jsonSchema: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(handler).not.toHaveBeenCalled();
    expect(mockedUiLogger.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('should fire usage tracking for --json-schema requests', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ jsonSchema: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(trackCommandUsageSpy).toHaveBeenCalledWith(
      'test-command',
      expect.objectContaining({ successful: true }),
      12345
    );
  });
});

describe('schema validation on emit', () => {
  type JsonArgs = CommonArgs & JSONOutputArgs;

  beforeEach(() => {
    trackCommandUsageSpy.mockResolvedValue(undefined);
    processExitSpy.mockImplementation(() => undefined as never);
  });

  it('should emit JSON when data passes schema validation', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string() });

    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ name: 'test' });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler, {
      jsonOutputSchema: schema,
    });

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({ name: 'test' });
  });

  it('should emit data with warning and exit WARNING when schema validation fails', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string(), required: z.number() });

    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ name: 'test' });
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler, {
      jsonOutputSchema: schema,
    });

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({ name: 'test' });
    expect(mockedUiLogger.warn).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
  });

  it('should upgrade exit(SUCCESS) to WARNING when schema validation fails', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string(), required: z.number() });

    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ name: 'test' });
        await args.exit(EXIT_CODES.SUCCESS);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler, {
      jsonOutputSchema: schema,
    });

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.json).toHaveBeenCalledWith({ name: 'test' });
    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
  });

  it('should not downgrade exit(ERROR) to WARNING when schema validation fails', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string(), required: z.number() });

    const handler = vi
      .fn()
      .mockImplementation(async (args: ArgumentsCamelCase<JsonArgs>) => {
        args.addJsonOutput({ name: 'test' });
        await args.exit(EXIT_CODES.ERROR);
      });
    const wrapped = makeWrappedYargsHandler('test-command', handler, {
      jsonOutputSchema: schema,
    });

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});

describe('logUsageTrackingMessage', () => {
  const version = pkg.version;

  beforeEach(() => {
    mockedGetConfig.mockReturnValue({ allowUsageTracking: true });
    mockedGetStateValue.mockReturnValue(undefined);
  });

  it('should not show message when json flag is true', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({ json: true } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.info).not.toHaveBeenCalled();
    expect(mockedSetStateValue).not.toHaveBeenCalled();
  });

  it('should not show message when formatOutputAsJson flag is true', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(
      makeArgs({
        formatOutputAsJson: true,
      } as Partial<ArgumentsCamelCase<CommonArgs>>)
    );

    expect(mockedUiLogger.info).not.toHaveBeenCalled();
  });

  it('should not show message when allowUsageTracking is not true', async () => {
    mockedGetConfig.mockReturnValue({ allowUsageTracking: false });
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.info).not.toHaveBeenCalled();
  });

  it('should not show message when allowUsageTracking is undefined', async () => {
    mockedGetConfig.mockReturnValue({});
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.info).not.toHaveBeenCalled();
  });

  it('should not show message when already shown for current version', async () => {
    mockedGetStateValue.mockReturnValue(version);
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.info).not.toHaveBeenCalled();
    expect(mockedSetStateValue).not.toHaveBeenCalled();
  });

  it('should show message and update state when conditions are met', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.info).toHaveBeenCalledWith(
      lib.usageTracking.transparencyMessage
    );
    expect(mockedSetStateValue).toHaveBeenCalledWith(
      STATE_FLAGS.USAGE_TRACKING_MESSAGE_LAST_SHOW_VERSION,
      version
    );
  });

  it('should show message when last shown version differs from current', async () => {
    mockedGetStateValue.mockReturnValue('0.0.1');
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.info).toHaveBeenCalledWith(
      lib.usageTracking.transparencyMessage
    );
    expect(mockedSetStateValue).toHaveBeenCalledWith(
      STATE_FLAGS.USAGE_TRACKING_MESSAGE_LAST_SHOW_VERSION,
      version
    );
  });

  it('should not show message when getConfig throws', async () => {
    mockedGetConfig.mockImplementation(() => {
      throw new Error('No config');
    });
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = makeWrappedYargsHandler('test-command', handler);

    await wrapped(makeArgs());

    expect(mockedUiLogger.info).not.toHaveBeenCalled();
  });
});
