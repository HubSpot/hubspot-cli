import util from 'util';
import {
  installPackages,
  updatePackages,
  getProjectPackageJsonLocations,
  isPackageInstalled,
} from '../dependencyManagement.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import path from 'path';
import { getProjectConfig } from '../projects/config.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import fs from 'fs';
import { Mock } from 'vitest';

vi.mock('../projects/config');
vi.mock('../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/fs');
vi.mock('fs');
vi.mock('../ui/SpinniesManager', () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  },
}));

const mockedFs = vi.mocked(fs);

describe('lib/dependencyManagement', () => {
  let execMock: Mock;

  const projectDir = path.join('path', 'to', 'project');
  const srcDir = 'src';
  const appDir = path.join(projectDir, srcDir, 'app');
  const appFunctionsDir = path.join(appDir, 'app.functions');
  const extensionsDir = path.join(appDir, 'exensions');
  const projectName = 'super cool test project';
  const installLocations = [appFunctionsDir, extensionsDir];

  function mockedPromisify(execMock: Mock): typeof util.promisify {
    return vi
      .fn()
      .mockReturnValue(execMock) as unknown as typeof util.promisify;
  }

  const mockedWalk = walk as Mock;
  const mockedGetProjectConfig = getProjectConfig as Mock;

  beforeEach(() => {
    execMock = vi.fn();
    util.promisify = mockedPromisify(execMock);
    mockedGetProjectConfig.mockResolvedValue({
      projectDir,
      projectConfig: {
        srcDir,
        name: projectName,
      },
    });
    mockedFs.existsSync.mockReturnValue(true); // Default to true, override in specific tests
    vi.clearAllMocks();
  });

  describe('installPackages()', () => {
    it('should setup a loading spinner', async () => {
      const packages = ['package1', 'package2'];
      await installPackages({ packages, installLocations });
      expect(SpinniesManager.init).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );
    });

    it('should install the provided packages in all the provided install locations', async () => {
      const packages = ['package1', 'package2'];
      await installPackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install package1 package2`, {
          cwd: location,
        });
        expect(SpinniesManager.add).toHaveBeenCalledWith(
          `installingDependencies-${location}`,
          {
            text: `Installing [package1, package2] in ${location}`,
          }
        );
        expect(SpinniesManager.succeed).toHaveBeenCalledWith(
          `installingDependencies-${location}`,
          {
            text: `Installed dependencies in ${location}`,
          }
        );
      }
    });

    it('should use the provided install locations', async () => {
      await installPackages({ installLocations });
      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: extensionsDir,
      });
    });

    it('should locate the projects package.json files when install locations is not provided', async () => {
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
      ];

      mockedWalk.mockResolvedValue(installLocations);

      mockedGetProjectConfig.mockResolvedValue({
        projectDir,
        projectConfig: {
          srcDir,
        },
      });

      await installPackages({});

      // It's called once per each install location, plus once to check if npm installed
      expect(execMock).toHaveBeenCalledTimes(installLocations.length + 1);
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: extensionsDir,
      });
    });

    it('should install packages as dev dependencies when dev flag is true', async () => {
      const packages = ['eslint', 'prettier'];
      await installPackages({ packages, installLocations, dev: true });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(
          `npm install --save-dev eslint prettier`,
          {
            cwd: location,
          }
        );
      }
    });

    it('should install packages as regular dependencies when dev flag is false', async () => {
      const packages = ['react', 'react-dom'];
      await installPackages({ packages, installLocations, dev: false });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install react react-dom`, {
          cwd: location,
        });
      }
    });

    it('should install packages as regular dependencies when dev flag is not provided', async () => {
      const packages = ['axios'];
      await installPackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install axios`, {
          cwd: location,
        });
      }
    });

    it('should not use --save-dev flag when dev is true but no packages are provided', async () => {
      await installPackages({ installLocations, dev: true });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install `, {
          cwd: location,
        });
      }
    });

    it('should not use --save-dev flag when dev is true but packages array is empty', async () => {
      await installPackages({ packages: [], installLocations, dev: true });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install `, {
          cwd: location,
        });
      }
    });

    it('should throw an error when installing the dependencies fails', async () => {
      execMock = vi.fn().mockImplementation(command => {
        if (command === 'npm --version') {
          return;
        }
        throw new Error('OH NO');
      });

      util.promisify = mockedPromisify(execMock);

      // Mock walk to return the directory paths instead of package.json paths
      mockedWalk.mockResolvedValue([appFunctionsDir, extensionsDir]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        installPackages({ installLocations: [appFunctionsDir, extensionsDir] })
      ).rejects.toThrowError(
        `Installing dependencies for ${appFunctionsDir} failed`
      );

      expect(SpinniesManager.fail).toHaveBeenCalledTimes(
        installLocations.length
      );

      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `installingDependencies-${appFunctionsDir}`,
        {
          text: `Installing dependencies for ${appFunctionsDir} failed`,
        }
      );
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `installingDependencies-${extensionsDir}`,
        {
          text: `Installing dependencies for ${extensionsDir} failed`,
        }
      );
    });
  });

  describe('updatePackages()', () => {
    it('should setup a loading spinner', async () => {
      const packages = ['package1', 'package2'];
      await updatePackages({ packages, installLocations });
      expect(SpinniesManager.init).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );
    });

    it('should update the provided packages in all the provided install locations', async () => {
      const packages = ['package1', 'package2'];
      await updatePackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm update package1 package2`, {
          cwd: location,
        });
        expect(SpinniesManager.add).toHaveBeenCalledWith(
          `updatingDependencies-${location}`,
          {
            text: `Updating [package1, package2] in ${location}`,
          }
        );
        expect(SpinniesManager.succeed).toHaveBeenCalledWith(
          `updatingDependencies-${location}`,
          {
            text: `Updated dependencies in ${location}`,
          }
        );
      }
    });

    it('should use the provided install locations', async () => {
      await updatePackages({ installLocations });
      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: extensionsDir,
      });
    });

    it('should locate the projects package.json files when install locations is not provided', async () => {
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
      ];

      mockedWalk.mockResolvedValue(installLocations);

      mockedGetProjectConfig.mockResolvedValue({
        projectDir,
        projectConfig: {
          srcDir,
        },
      });

      await updatePackages({});

      // It's called once per each install location, plus once to check if npm installed
      expect(execMock).toHaveBeenCalledTimes(installLocations.length + 1);
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: extensionsDir,
      });
    });

    it('should throw an error when updating the dependencies fails', async () => {
      execMock = vi.fn().mockImplementation(command => {
        if (command === 'npm --version') {
          return;
        }
        throw new Error('OH NO');
      });

      util.promisify = mockedPromisify(execMock);

      // Mock walk to return the directory paths instead of package.json paths
      mockedWalk.mockResolvedValue([appFunctionsDir, extensionsDir]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        updatePackages({ installLocations: [appFunctionsDir, extensionsDir] })
      ).rejects.toThrowError(
        `Updating dependencies for ${appFunctionsDir} failed`
      );

      expect(SpinniesManager.fail).toHaveBeenCalledTimes(
        installLocations.length
      );

      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `updatingDependencies-${appFunctionsDir}`,
        {
          text: `Updating dependencies for ${appFunctionsDir} failed`,
        }
      );
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `updatingDependencies-${extensionsDir}`,
        {
          text: `Updating dependencies for ${extensionsDir} failed`,
        }
      );
    });
  });

  describe('getProjectPackageJsonFiles()', () => {
    it('should throw an error when ran outside the boundary of a project', async () => {
      mockedGetProjectConfig.mockResolvedValue({});
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        'No project detected. Run this command from a project directory.'
      );
    });

    it('should throw an error if npm is not globally installed', async () => {
      execMock = vi.fn().mockImplementation(() => {
        throw new Error('OH NO');
      });
      util.promisify = mockedPromisify(execMock);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        /This command depends on npm, install/
      );
    });

    it('should throw an error if the project directory does not exist', async () => {
      mockedFs.existsSync.mockReturnValueOnce(false);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        new RegExp(
          `No dependencies to install. The project ${projectName} folder might be missing component or subcomponent files.`
        )
      );
    });

    it('should throw "install" error message when isUpdate=false and no package.json files found', async () => {
      mockedWalk.mockResolvedValue([]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        getProjectPackageJsonLocations(undefined, false)
      ).rejects.toThrowError(
        new RegExp(
          `No dependencies to install. The project ${projectName} folder might be missing component or subcomponent files.`
        )
      );
    });

    it('should throw "update" error message when isUpdate=true and no package.json files found', async () => {
      mockedWalk.mockResolvedValue([]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        getProjectPackageJsonLocations(undefined, true)
      ).rejects.toThrowError(
        new RegExp(
          `No dependencies to update. The project ${projectName} folder might be missing component or subcomponent files.`
        )
      );
    });

    it('should ignore package.json files in certain directories', async () => {
      const nodeModulesDir = path.join(appDir, 'node_modules');
      const viteDir = path.join(appDir, '.vite');
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
        path.join(viteDir, 'package.json'),
        path.join(nodeModulesDir, 'package.json'),
      ];

      mockedWalk.mockResolvedValue(installLocations);
      mockedFs.existsSync.mockImplementation(filePath => {
        // Return true for project directory and src directory
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      const actual = await getProjectPackageJsonLocations();
      expect(actual).toEqual([appFunctionsDir, extensionsDir]);
    });
  });

  describe('isPackageInstalled()', () => {
    const testDir = '/test/directory';
    const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
    const existsSyncSpy = vi.spyOn(fs, 'existsSync');

    function mockNodeModulesExists(packageName: string, exists = true): void {
      existsSyncSpy.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        return (
          exists && pathStr === path.join(testDir, 'node_modules', packageName)
        );
      });
    }

    beforeEach(() => {
      vi.clearAllMocks();
      readFileSyncSpy.mockReset();
      existsSyncSpy.mockReset();
    });

    it('should return true if package is in dependencies and in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      mockNodeModulesExists('eslint', true);

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(true);
      expect(readFileSyncSpy).toHaveBeenCalledWith(
        path.join(testDir, 'package.json'),
        'utf-8'
      );
      expect(existsSyncSpy).toHaveBeenCalledWith(
        path.join(testDir, 'node_modules', 'eslint')
      );
    });

    it('should return true if package is in devDependencies and in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          devDependencies: {
            prettier: '^3.0.0',
          },
        })
      );
      mockNodeModulesExists('prettier', true);

      const result = isPackageInstalled(testDir, 'prettier');

      expect(result).toBe(true);
    });

    it('should return false if package is in package.json but not in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
          },
        })
      );
      mockNodeModulesExists('react', false);

      const result = isPackageInstalled(testDir, 'react');

      expect(result).toBe(false);
    });

    it('should return false if package is not in package.json but is in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            typescript: '^5.0.0',
          },
        })
      );
      mockNodeModulesExists('lodash', true);

      const result = isPackageInstalled(testDir, 'lodash');

      expect(result).toBe(false);
    });

    it('should return false if package is not in package.json and not in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {},
        })
      );
      mockNodeModulesExists('nonexistent-package', false);

      const result = isPackageInstalled(testDir, 'nonexistent-package');

      expect(result).toBe(false);
    });

    it('should return false if package.json cannot be read', () => {
      readFileSyncSpy.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(false);
    });

    it('should return false if package.json has invalid JSON', () => {
      readFileSyncSpy.mockReturnValueOnce('invalid json{');

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(false);
    });

    it('should return false if checking node_modules throws an error', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      existsSyncSpy.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(false);
    });

    it('should handle scoped packages correctly', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            '@typescript-eslint/parser': '^8.0.0',
          },
        })
      );
      mockNodeModulesExists('@typescript-eslint/parser', true);

      const result = isPackageInstalled(testDir, '@typescript-eslint/parser');

      expect(result).toBe(true);
      expect(existsSyncSpy).toHaveBeenCalledWith(
        path.join(testDir, 'node_modules', '@typescript-eslint/parser')
      );
    });

    it('should check both dependencies and devDependencies', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
          },
          devDependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      mockNodeModulesExists('eslint', true);

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(true);
    });
  });
});
