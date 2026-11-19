import { LOG_LEVEL, setLogLevel } from '@hubspot/local-dev-lib/logger';
import { debugError } from '../../errorHandlers/index.js';
import { uiLogger } from '../../ui/logger.js';
import { shouldShowHint, showHint, type Hint } from '../hints.js';
import { hasShownWithin, recordShown } from '../throttle.js';

vi.mock('../throttle.js');
vi.mock('../../errorHandlers/index.js', () => ({
  debugError: vi.fn(),
}));

const mockedHasShownWithin = vi.mocked(hasShownWithin);
const mockedRecordShown = vi.mocked(recordShown);
const mockedDebugError = vi.mocked(debugError);
const mockedUiLogger = vi.mocked(uiLogger);

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

const mockHint: Hint = {
  lastShownFlag: 'mcpPromotionLastShownAt',
  cooldownMs: ONE_HOUR_IN_MS,
  message: 'Run hs example',
};

describe('lib/hints/hints', () => {
  const originalCI = process.env.CI;
  const originalStderrIsTTY = process.stderr.isTTY;

  function setStderrIsTTY(isTTY: boolean): void {
    Object.defineProperty(process.stderr, 'isTTY', {
      configurable: true,
      value: isTTY,
    });
  }

  beforeEach(() => {
    delete process.env.CI;
    setStderrIsTTY(true);
    setLogLevel(LOG_LEVEL.LOG);
    mockedHasShownWithin.mockReturnValue(false);
  });

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
    setStderrIsTTY(originalStderrIsTTY);
    setLogLevel(LOG_LEVEL.ERROR);
  });

  describe('shouldShowHint()', () => {
    it('should return true when nothing suppresses the hint', () => {
      expect(shouldShowHint(mockHint)).toBe(true);
    });

    it('should return false when running in CI', () => {
      process.env.CI = 'true';

      expect(shouldShowHint(mockHint)).toBe(false);
      expect(mockedHasShownWithin).not.toHaveBeenCalled();
    });

    it('should return false when stderr is not a TTY', () => {
      setStderrIsTTY(false);

      expect(shouldShowHint(mockHint)).toBe(false);
      expect(mockedHasShownWithin).not.toHaveBeenCalled();
    });

    it('should return false when the log level hides log output', () => {
      setLogLevel(LOG_LEVEL.ERROR);

      expect(shouldShowHint(mockHint)).toBe(false);
      expect(mockedHasShownWithin).not.toHaveBeenCalled();
    });

    it('should return true when the log level is debug', () => {
      setLogLevel(LOG_LEVEL.DEBUG);

      expect(shouldShowHint(mockHint)).toBe(true);
    });

    it('should return false when the hint was shown inside the cooldown', () => {
      mockedHasShownWithin.mockReturnValue(true);

      expect(shouldShowHint(mockHint)).toBe(false);
      expect(mockedHasShownWithin).toHaveBeenCalledWith(
        mockHint.lastShownFlag,
        mockHint.cooldownMs
      );
    });

    it('should return false when the hint is not applicable', () => {
      const isApplicable = vi.fn().mockReturnValue(false);

      expect(shouldShowHint({ ...mockHint, isApplicable })).toBe(false);
    });

    it('should not check applicability when the hint was shown inside the cooldown', () => {
      mockedHasShownWithin.mockReturnValue(true);
      const isApplicable = vi.fn().mockReturnValue(true);

      shouldShowHint({ ...mockHint, isApplicable });

      expect(isApplicable).not.toHaveBeenCalled();
    });

    it('should return true when the hint is applicable', () => {
      const isApplicable = vi.fn().mockReturnValue(true);

      expect(shouldShowHint({ ...mockHint, isApplicable })).toBe(true);
    });
  });

  describe('showHint()', () => {
    it('should record the hint and write it with uiLogger.hint', () => {
      expect(showHint(mockHint)).toBe(true);

      expect(mockedRecordShown).toHaveBeenCalledWith(mockHint.lastShownFlag);
      expect(mockedUiLogger.hint).toHaveBeenCalledWith(mockHint.message);
      expect(mockedUiLogger.info).not.toHaveBeenCalled();
    });

    it('should not record the hint when the log level hides log output', () => {
      setLogLevel(LOG_LEVEL.ERROR);

      expect(showHint(mockHint)).toBe(false);

      expect(mockedRecordShown).not.toHaveBeenCalled();
      expect(mockedUiLogger.hint).not.toHaveBeenCalled();
    });

    it('should return false and write nothing when the hint is suppressed', () => {
      process.env.CI = 'true';

      expect(showHint(mockHint)).toBe(false);

      expect(mockedRecordShown).not.toHaveBeenCalled();
      expect(mockedUiLogger.hint).not.toHaveBeenCalled();
    });

    it('should not write the hint when recording state fails', () => {
      const error = new Error('state write failed');
      mockedRecordShown.mockImplementation(() => {
        throw error;
      });

      expect(showHint(mockHint)).toBe(false);

      expect(mockedUiLogger.hint).not.toHaveBeenCalled();
      expect(mockedDebugError).toHaveBeenCalledWith(error);
    });
  });
});
