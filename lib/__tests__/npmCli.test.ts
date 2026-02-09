import util from 'util';
import {
  isGloballyInstalled,
  getLatestPackageVersion,
  isInstalledGloballyWithNPM,
  DEFAULT_PACKAGE_MANAGER,
} from '../npm/npmCli.js';
import { pkg } from '../jsonLoader.js';
import { Mock } from 'vitest';

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

  describe('getLatestPackageVersion()', () => {
    it('should return the version correctly', async () => {
      const latest = '1.0.0';
      const next = '1.0.0.beta.1';
      execMock.mockResolvedValueOnce({
        stdout: JSON.stringify({ latest, next }),
      });

      util.promisify = mockedPromisify(execMock);
      const actual = await getLatestPackageVersion(pkg.name);

      expect(actual).toEqual({ latest, next });
      expect(execMock).toHaveBeenCalledWith(
        `npm info ${pkg.name} dist-tags --json`
      );
    });

    it('should return null values when the check fails', async () => {
      const errorMessage = 'unsuccessful';
      execMock.mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });
      util.promisify = mockedPromisify(execMock);

      const result = await getLatestPackageVersion(pkg.name);

      expect(result).toEqual({ latest: null, next: null });
      expect(execMock).toHaveBeenCalledWith(
        `npm info ${pkg.name} dist-tags --json`
      );
    });
  });

  describe('isInstalledGloballyWithNPM()', () => {
    it('should return true when npm is installed and package is in npm global list', async () => {
      execMock.mockResolvedValueOnce({ stdout: '', stderr: '' }); // npm check
      execMock.mockResolvedValueOnce({ stdout: '', stderr: '' }); // npm list succeeds

      const result = await isInstalledGloballyWithNPM('@hubspot/cli');

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(2);
      expect(execMock).toHaveBeenNthCalledWith(1, 'npm --version');
      expect(execMock).toHaveBeenNthCalledWith(
        2,
        'npm list -g @hubspot/cli --depth=0'
      );
    });

    it('should return false when npm is not globally installed', async () => {
      execMock.mockRejectedValueOnce(new Error('npm not found')); // npm check fails

      const result = await isInstalledGloballyWithNPM('@hubspot/cli');

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith('npm --version');
    });

    it('should return false when npm list fails (package not installed via npm)', async () => {
      execMock.mockResolvedValueOnce({ stdout: '', stderr: '' }); // npm check
      execMock.mockRejectedValueOnce(new Error('Package not found')); // npm list fails

      const result = await isInstalledGloballyWithNPM('@hubspot/cli');

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(2);
      expect(execMock).toHaveBeenNthCalledWith(1, 'npm --version');
      expect(execMock).toHaveBeenNthCalledWith(
        2,
        'npm list -g @hubspot/cli --depth=0'
      );
    });
  });
});
