import util from 'util';
import {
  isGloballyInstalled,
  getLatestCliVersion,
  DEFAULT_PACKAGE_MANAGER,
} from '../npm.js';
import pkg from '../../package.json' with { type: 'json' };
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/logger');
vi.mock('../ui/SpinniesManager');

describe('lib/npm', () => {
  let execMock: Mock;

  function mockedPromisify(execMock: Mock): typeof util.promisify {
    return vi
      .fn()
      .mockReturnValue(execMock) as unknown as typeof util.promisify;
  }

  beforeEach(() => {
    execMock = vi.fn();
    util.promisify = mockedPromisify(execMock);
  });

  describe('isGloballyInstalled()', () => {
    it('should return true when exec is successful', async () => {
      const actual = await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER);

      expect(actual).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith(
        `${DEFAULT_PACKAGE_MANAGER} --version`
      );
    });

    it('should return false when exec is unsuccessful', async () => {
      execMock.mockImplementationOnce(() => {
        throw new Error('unsuccessful');
      });
      util.promisify = mockedPromisify(execMock);
      const actual = await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER);

      expect(actual).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith(
        `${DEFAULT_PACKAGE_MANAGER} --version`
      );
    });
  });

  describe('getLatestCliVersion()', () => {
    it('should return the version correctly', async () => {
      const latest = '1.0.0';
      const next = '1.0.0.beta.1';
      execMock.mockResolvedValueOnce({
        stdout: JSON.stringify({ latest, next }),
      });

      util.promisify = mockedPromisify(execMock);
      const actual = await getLatestCliVersion();

      expect(actual).toEqual({ latest, next });
      expect(execMock).toHaveBeenCalledWith(
        `npm info ${pkg.name} dist-tags --json`
      );
    });

    it('should throw any errors that encounter with the check', async () => {
      const errorMessage = 'unsuccessful';
      execMock.mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });
      util.promisify = mockedPromisify(execMock);

      await expect(() => getLatestCliVersion()).rejects.toThrow(errorMessage);
      expect(execMock).toHaveBeenCalledWith(
        `npm info ${pkg.name} dist-tags --json`
      );
    });
  });
});
