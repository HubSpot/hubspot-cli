import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { checkDeprecationWarning } from '../deprecationWarningMiddleware.js';
import { pkg } from '../../jsonLoader.js';
import { debugError } from '../../errorHandlers/index.js';

vi.mock('@hubspot/local-dev-lib/config/state');
vi.mock('../../jsonLoader.js', () => ({
  pkg: { name: '@hubspot/cli', version: '7.11.3' },
}));
vi.mock('../../errorHandlers/index.js', () => ({
  debugError: vi.fn(),
}));
vi.mock('../../../ui/render.js', () => ({
  renderInline: vi.fn(),
}));

const mockedGetStateValue = vi.mocked(getStateValue);
const mockedSetStateValue = vi.mocked(setStateValue);
const mockedDebugError = vi.mocked(debugError);

describe('lib/middleware/deprecationWarningMiddleware', () => {
  describe('checkDeprecationWarning()', () => {
    beforeEach(() => {
      pkg.version = '7.11.3';
      mockedGetStateValue.mockReturnValue(undefined);
      vi.useFakeTimers();
      // CLI_DEPRECATED_MAJOR_VERSION_DEPRECATION_DATE is 2026-09-02, EOL is
      // 2027-03-01 — this sits in the deprecated (not yet EOL) window.
      vi.setSystemTime(new Date('2026-09-08T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log a deprecation warning when past the deprecation date but before the EOL date', async () => {
      const { renderInline } = await import('../../../ui/render.js');

      await checkDeprecationWarning();

      expect(renderInline).toHaveBeenCalledTimes(1);
      expect(mockedSetStateValue).toHaveBeenCalledWith(
        'cliVersionDeprecationWarningLastShownAt',
        expect.any(String)
      );
    });

    it('should log an end-of-life warning when past the EOL date', async () => {
      vi.setSystemTime(new Date('2027-04-01T00:00:00Z'));
      const { renderInline } = await import('../../../ui/render.js');

      await checkDeprecationWarning();

      expect(renderInline).toHaveBeenCalledTimes(1);
      expect(mockedSetStateValue).toHaveBeenCalledWith(
        'cliVersionEndOfLifeWarningLastShownAt',
        expect.any(String)
      );
    });

    it('should not log a warning when the current major version is not the deprecated major version', async () => {
      pkg.version = '8.15.0';
      const { renderInline } = await import('../../../ui/render.js');

      await checkDeprecationWarning();

      expect(renderInline).not.toHaveBeenCalled();
      expect(mockedSetStateValue).not.toHaveBeenCalled();
    });

    it('should not log a warning when before the deprecation date', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const { renderInline } = await import('../../../ui/render.js');

      await checkDeprecationWarning();

      expect(renderInline).not.toHaveBeenCalled();
      expect(mockedSetStateValue).not.toHaveBeenCalled();
    });

    it('should not log the deprecation warning when it has already been shown within the last day', async () => {
      mockedGetStateValue.mockImplementation(key =>
        key === 'cliVersionDeprecationWarningLastShownAt'
          ? new Date(Date.now() - 1000).toISOString()
          : undefined
      );
      const { renderInline } = await import('../../../ui/render.js');

      await checkDeprecationWarning();

      expect(renderInline).not.toHaveBeenCalled();
      expect(mockedSetStateValue).not.toHaveBeenCalled();
    });

    it('should still log the end-of-life warning when the deprecation warning was already shown today', async () => {
      vi.setSystemTime(new Date('2027-04-01T00:00:00Z'));
      mockedGetStateValue.mockImplementation(key =>
        key === 'cliVersionDeprecationWarningLastShownAt'
          ? new Date(Date.now() - 1000).toISOString()
          : undefined
      );
      const { renderInline } = await import('../../../ui/render.js');

      await checkDeprecationWarning();

      expect(renderInline).toHaveBeenCalledTimes(1);
      expect(mockedSetStateValue).toHaveBeenCalledWith(
        'cliVersionEndOfLifeWarningLastShownAt',
        expect.any(String)
      );
    });

    it('should not throw when reading or writing state fails', async () => {
      mockedGetStateValue.mockImplementation(() => {
        throw new Error('boom');
      });

      await expect(checkDeprecationWarning()).resolves.toBeUndefined();
      expect(mockedDebugError).toHaveBeenCalled();
    });
  });
});
