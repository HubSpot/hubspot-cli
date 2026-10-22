import {
  hasLocalStateFlag,
  getConfigDefaultAccountIfExists,
  isConfigFlagEnabled,
} from '@hubspot/local-dev-lib/config';
import { CONFIG_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { uiLogger } from '../../ui/logger.js';
import { uiLine, uiCommandReference } from '../../ui/index.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { logError } from '../../errorHandlers/index.js';
import { CONFIG_LOCAL_STATE_FLAGS } from '../../constants.js';
import { lib } from '../../../lang/en.js';
import LocalDevState from '../localDev/LocalDevState.js';
import LocalDevLogger from '../localDev/LocalDevLogger.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/urls', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/urls')>();
  return {
    ...actual,
    getHubSpotWebsiteOriginByAccountId: vi
      .fn()
      .mockReturnValue('https://app.hubspot.com'),
  };
});
vi.mock('../../ui/SpinniesManager.js');
vi.mock('../../ui/index.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../ui/index.js')>();
  return {
    ...actual,
    uiLine: vi.fn(),
    uiAccountDescription: vi.fn().mockReturnValue('mock-account (123)'),
  };
});
vi.mock('../../errorHandlers/index.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../errorHandlers/index.js')>();
  return { ...actual, logError: vi.fn() };
});

const mockedHasLocalStateFlag = vi.mocked(hasLocalStateFlag);
const mockedGetConfigDefaultAccountIfExists = vi.mocked(
  getConfigDefaultAccountIfExists
);
const mockedIsConfigFlagEnabled = vi.mocked(isConfigFlagEnabled);
const mockedUiLogger = vi.mocked(uiLogger);
const mockedUiLine = vi.mocked(uiLine);
const mockedSpinniesManager = vi.mocked(SpinniesManager);
const mockedLogError = vi.mocked(logError);

const MOCK_TARGET_PROJECT_ACCOUNT_ID = 111;
const MOCK_TARGET_TESTING_ACCOUNT_ID = 222;
const MOCK_PROJECT_NAME = 'my-project';

function buildMockState(overrides: Partial<LocalDevState> = {}): LocalDevState {
  return {
    debug: false,
    targetProjectAccountId: MOCK_TARGET_PROJECT_ACCOUNT_ID,
    targetTestingAccountId: MOCK_TARGET_TESTING_ACCOUNT_ID,
    projectConfig: { name: MOCK_PROJECT_NAME, srcDir: 'src' },
    uploadWarnings: new Set<string>(),
    autoUploadEnabled: false,
    ...overrides,
  } as unknown as LocalDevState;
}

describe('lib/projects/localDev/LocalDevLogger', () => {
  let mockState: LocalDevState;
  let localDevLogger: LocalDevLogger;

  beforeEach(() => {
    mockState = buildMockState();
    localDevLogger = new LocalDevLogger(mockState);
    mockedGetConfigDefaultAccountIfExists.mockReturnValue({
      accountId: MOCK_TARGET_PROJECT_ACCOUNT_ID,
    } as HubSpotConfigAccount);
    mockedHasLocalStateFlag.mockReturnValue(true);
    mockedIsConfigFlagEnabled.mockReturnValue(false);
  });

  describe('getUploadCommand()', () => {
    it('should return the plain upload command when the target account is the default account', () => {
      expect(localDevLogger.getUploadCommand()).toBe(
        uiCommandReference('hs project upload')
      );
    });

    it('should include the account flag when the target account is not the default account', () => {
      mockedGetConfigDefaultAccountIfExists.mockReturnValue({
        accountId: 999,
      } as HubSpotConfigAccount);

      expect(localDevLogger.getUploadCommand()).toBe(
        uiCommandReference(
          `hs project upload --account=${MOCK_TARGET_PROJECT_ACCOUNT_ID}`
        )
      );
    });

    it('should include the account flag when there is no default account', () => {
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

      expect(localDevLogger.getUploadCommand()).toBe(
        uiCommandReference(
          `hs project upload --account=${MOCK_TARGET_PROJECT_ACCOUNT_ID}`
        )
      );
    });
  });

  describe('uploadWarning()', () => {
    it('should log the default warning with the upload instructions', () => {
      localDevLogger.uploadWarning();

      expect(mockedUiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          lib.LocalDevManager.uploadWarning.defaultWarning
        )
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.uploadWarning.instructionsHeader
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.uploadWarning.stopDev
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.uploadWarning.runUpload(
          localDevLogger.getUploadCommand()
        )
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.uploadWarning.restartDev
      );
    });

    it('should include additional upload warnings from state', () => {
      mockState = buildMockState({
        uploadWarnings: new Set(['first warning', 'second warning']),
      });
      localDevLogger = new LocalDevLogger(mockState);

      localDevLogger.uploadWarning();

      expect(mockedUiLogger.warn).toHaveBeenCalledWith(
        `${lib.LocalDevManager.uploadWarning.defaultWarning} first warning\n\nsecond warning`
      );
    });

    it('should not log the same warning twice in a row', () => {
      localDevLogger.uploadWarning();
      mockedUiLogger.warn.mockClear();

      localDevLogger.uploadWarning();

      expect(mockedUiLogger.warn).not.toHaveBeenCalled();
    });

    it('should log again when the warning changes', () => {
      localDevLogger.uploadWarning();
      mockedUiLogger.warn.mockClear();
      mockState = buildMockState({ uploadWarnings: new Set(['new warning']) });
      localDevLogger = new LocalDevLogger(mockState);

      localDevLogger.uploadWarning();

      expect(mockedUiLogger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('missingComponentsWarning()', () => {
    it('should log a warning listing the missing components', () => {
      localDevLogger.missingComponentsWarning(['card-a', 'card-b']);

      expect(mockedUiLogger.warn).toHaveBeenCalledWith(
        lib.LocalDevManager.uploadWarning.missingComponents('card-a, card-b')
      );
    });

    it('should log the upload instructions with the warning', () => {
      localDevLogger.missingComponentsWarning(['card-a']);

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.uploadWarning.instructionsHeader
      );
    });

    it('should not log the same missing components warning twice in a row', () => {
      localDevLogger.missingComponentsWarning(['card-a']);
      mockedUiLogger.warn.mockClear();

      localDevLogger.missingComponentsWarning(['card-a']);

      expect(mockedUiLogger.warn).not.toHaveBeenCalled();
    });

    it('should log again when a different set of components is missing', () => {
      localDevLogger.missingComponentsWarning(['card-a']);
      mockedUiLogger.warn.mockClear();

      localDevLogger.missingComponentsWarning(['card-b']);

      expect(mockedUiLogger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('error loggers', () => {
    type ErrorLoggerName =
      | 'fileChangeError'
      | 'devServerSetupError'
      | 'devServerStartError'
      | 'devServerCleanupError'
      | 'devSessionRegistrationError'
      | 'devSessionHeartbeatError'
      | 'devSessionDeletionError';

    const errorLoggerCases: {
      name: ErrorLoggerName;
      format: (message: string) => string;
    }[] = [
      {
        name: 'fileChangeError',
        format: lib.LocalDevManager.devServer.fileChangeError,
      },
      {
        name: 'devServerSetupError',
        format: lib.LocalDevManager.devServer.setupError,
      },
      {
        name: 'devServerStartError',
        format: lib.LocalDevManager.devServer.startError,
      },
      {
        name: 'devServerCleanupError',
        format: lib.LocalDevManager.devServer.cleanupError,
      },
      {
        name: 'devSessionRegistrationError',
        format: lib.LocalDevManager.devSession.registrationError,
      },
      {
        name: 'devSessionHeartbeatError',
        format: lib.LocalDevManager.devSession.heartbeatError,
      },
      {
        name: 'devSessionDeletionError',
        format: lib.LocalDevManager.devSession.deletionError,
      },
    ];

    errorLoggerCases.forEach(({ name, format }) => {
      describe(`${name}()`, () => {
        it('should log the formatted error message for an Error', () => {
          localDevLogger[name](new Error('boom'));

          expect(mockedUiLogger.error).toHaveBeenCalledTimes(1);
          expect(mockedUiLogger.error).toHaveBeenCalledWith(format('boom'));
        });

        it('should log the formatted error message for a non-Error value', () => {
          localDevLogger[name]('string failure');

          expect(mockedUiLogger.error).toHaveBeenCalledWith(
            format('string failure')
          );
        });

        it('should also log the raw error message first when debug is enabled', () => {
          mockState = buildMockState({ debug: true });
          localDevLogger = new LocalDevLogger(mockState);

          localDevLogger[name](new Error('boom'));

          expect(mockedUiLogger.error).toHaveBeenCalledTimes(2);
          expect(mockedUiLogger.error).toHaveBeenNthCalledWith(1, 'boom');
          expect(mockedUiLogger.error).toHaveBeenNthCalledWith(
            2,
            format('boom')
          );
        });
      });
    });

    describe('devSessionMissingSessionIdError()', () => {
      it('should log the missing session ID error', () => {
        localDevLogger.devSessionMissingSessionIdError();

        expect(mockedUiLogger.error).toHaveBeenCalledWith(
          lib.LocalDevManager.devSession.missingSessionIdError
        );
      });
    });
  });

  describe('resetSpinnies()', () => {
    it('should stop all spinnies', () => {
      localDevLogger.resetSpinnies();

      expect(mockedSpinniesManager.stopAll).toHaveBeenCalled();
    });
  });

  describe('startupMessage()', () => {
    const consoleClearSpy = vi
      .spyOn(console, 'clear')
      .mockImplementation(() => undefined);

    it('should clear the console when debug is disabled', () => {
      localDevLogger.startupMessage();

      expect(consoleClearSpy).toHaveBeenCalled();
    });

    it('should not clear the console when debug is enabled', () => {
      mockState = buildMockState({ debug: true });
      localDevLogger = new LocalDevLogger(mockState);

      localDevLogger.startupMessage();

      expect(consoleClearSpy).not.toHaveBeenCalled();
    });

    it('should log the header, running message, and quit helper', () => {
      localDevLogger.startupMessage();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.headerMessage
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.learnMoreLocalDevServer
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.running(MOCK_PROJECT_NAME, 'mock-account (123)')
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.quitHelper
      );
      expect(mockedUiLine).toHaveBeenCalled();
    });

    it('should log the project link for the target project account', () => {
      localDevLogger.startupMessage();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.viewProjectLink(
          MOCK_PROJECT_NAME,
          MOCK_TARGET_PROJECT_ACCOUNT_ID
        )
      );
    });

    it('should check whether the welcome screen has been shown', () => {
      localDevLogger.startupMessage();

      expect(mockedHasLocalStateFlag).toHaveBeenCalledWith(
        CONFIG_LOCAL_STATE_FLAGS.LOCAL_DEV_UI_WELCOME
      );
    });

    it('should log the local dev UI link when auto open browser is disabled', () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);

      localDevLogger.startupMessage();

      expect(mockedIsConfigFlagEnabled).toHaveBeenCalledWith(
        CONFIG_FLAGS.AUTO_OPEN_BROWSER,
        true
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.viewLocalDevUILink(
          MOCK_TARGET_TESTING_ACCOUNT_ID,
          false
        )
      );
    });

    it('should log the auto open message when auto open browser is enabled', () => {
      mockedIsConfigFlagEnabled.mockReturnValue(true);

      localDevLogger.startupMessage();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.localDevUIAutoMessage(
          MOCK_TARGET_TESTING_ACCOUNT_ID,
          false
        )
      );
    });

    it('should request the welcome screen when the welcome flag has not been set', () => {
      mockedHasLocalStateFlag.mockReturnValue(false);

      localDevLogger.startupMessage();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.viewLocalDevUILink(
          MOCK_TARGET_TESTING_ACCOUNT_ID,
          true
        )
      );
    });

    it('should log the auto upload message when auto upload is enabled', () => {
      mockState = buildMockState({ autoUploadEnabled: true });
      localDevLogger = new LocalDevLogger(mockState);

      localDevLogger.startupMessage();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevManager.autoUploadEnabled
      );
    });

    it('should not log the auto upload message when auto upload is disabled', () => {
      localDevLogger.startupMessage();

      expect(mockedUiLogger.log).not.toHaveBeenCalledWith(
        lib.LocalDevManager.autoUploadEnabled
      );
    });
  });

  describe('cleanup spinners', () => {
    it('should add a cleanup spinner on cleanupStart()', () => {
      localDevLogger.cleanupStart();

      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('cleanupMessage', {
        text: lib.LocalDevManager.exitingStart,
      });
    });

    it('should fail the cleanup spinner on cleanupError()', () => {
      localDevLogger.cleanupError();

      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith(
        'cleanupMessage',
        { text: lib.LocalDevManager.exitingFail }
      );
    });

    it('should succeed the cleanup spinner on cleanupSuccess()', () => {
      localDevLogger.cleanupSuccess();

      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith(
        'cleanupMessage',
        { text: lib.LocalDevManager.exitingSucceed }
      );
    });
  });

  describe('upload and deploy messages', () => {
    it('should log the upload initiated message', () => {
      localDevLogger.uploadInitiated();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.uploadInitiated
      );
    });

    it('should debug log the scheduled auto upload with the file path', () => {
      localDevLogger.autoUploadScheduled('/path/to/file.json');

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        lib.LocalDevProcess.autoUploadScheduled('/path/to/file.json')
      );
    });

    it('should debug log the triggered auto upload', () => {
      localDevLogger.autoUploadTriggered();

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        lib.LocalDevProcess.autoUploadTriggered
      );
    });

    it('should debug log the in-progress auto upload', () => {
      localDevLogger.autoUploadInProgress();

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        lib.LocalDevProcess.autoUploadInProgress
      );
    });

    it('should log the toggled auto upload message when enabled', () => {
      localDevLogger.autoUploadToggled(true);

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.autoUploadToggled(true)
      );
    });

    it('should log the toggled auto upload message when disabled', () => {
      localDevLogger.autoUploadToggled(false);

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.autoUploadToggled(false)
      );
    });

    it('should log the deploy initiated message', () => {
      localDevLogger.deployInitiated();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.deployInitiated
      );
    });

    it('should log the project config mismatch message', () => {
      localDevLogger.projectConfigMismatch();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.projectConfigMismatch
      );
    });

    it('should log the error and the upload failed message on uploadError()', () => {
      const error = new Error('upload failed');

      localDevLogger.uploadError(error);

      expect(mockedLogError).toHaveBeenCalledWith(error);
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.uploadFailed
      );
    });

    it('should log the success message and a divider on uploadSuccess()', () => {
      localDevLogger.uploadSuccess();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.uploadSuccess
      );
      expect(mockedUiLine).toHaveBeenCalled();
    });

    it('should warn and log a divider on uploadSuccessAutoDeployDisabled()', () => {
      localDevLogger.uploadSuccessAutoDeployDisabled();

      expect(mockedUiLogger.warn).toHaveBeenCalledWith(
        lib.LocalDevProcess.uploadSuccessAutoDeployDisabled
      );
      expect(mockedUiLine).toHaveBeenCalled();
    });

    it('should log the error and the deploy failed message on deployError() with an error', () => {
      const error = new Error('deploy failed');

      localDevLogger.deployError(error);

      expect(mockedLogError).toHaveBeenCalledWith(error);
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.deployFailed
      );
    });

    it('should only log the deploy failed message on deployError() without an error', () => {
      localDevLogger.deployError();

      expect(mockedLogError).not.toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.deployFailed
      );
    });

    it('should log the success message and a divider on deploySuccess()', () => {
      localDevLogger.deploySuccess();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.LocalDevProcess.deploySuccess
      );
      expect(mockedUiLine).toHaveBeenCalled();
    });
  });

  describe('monitorConsoleOutput()', () => {
    const originalStdoutWrite = process.stdout.write;
    let mockedStdoutWrite: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockedStdoutWrite = vi.fn().mockReturnValue(true);
      process.stdout.write =
        mockedStdoutWrite as unknown as typeof process.stdout.write;
    });

    afterEach(() => {
      process.stdout.write = originalStdoutWrite;
    });

    it('should replace process.stdout.write', () => {
      localDevLogger.monitorConsoleOutput();

      expect(process.stdout.write).not.toBe(mockedStdoutWrite);
    });

    it('should forward the written chunk to the original write', () => {
      localDevLogger.monitorConsoleOutput();

      process.stdout.write('output');

      expect(mockedStdoutWrite).toHaveBeenCalledWith(
        'output',
        undefined,
        undefined
      );
    });

    it('should forward writes with an encoding and callback to the original write', () => {
      const callback = vi.fn();
      localDevLogger.monitorConsoleOutput();

      process.stdout.write('output', 'utf8', callback);

      expect(mockedStdoutWrite).toHaveBeenCalledWith(
        'output',
        'utf8',
        callback
      );
    });

    it('should return the result of the original write', () => {
      mockedStdoutWrite.mockReturnValue(false);
      localDevLogger.monitorConsoleOutput();

      const result = process.stdout.write('output');

      expect(result).toBe(false);
    });
  });
});
