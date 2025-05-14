import util from 'util';
import {
  installPackages,
  getProjectPackageJsonLocations,
} from '../dependencyManagement';
import { walk } from '@hubspot/local-dev-lib/fs';
import path from 'path';
import { getProjectConfig } from '../projects/config';
import SpinniesManager from '../ui/SpinniesManager';
import { existsSync } from 'fs';

jest.mock('../projects/config');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/fs');
jest.mock('../ui/SpinniesManager');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
}));

describe('lib/dependencyManagement', () => {
  let execMock: jest.Mock;

  const projectDir = path.join('path', 'to', 'project');
  const srcDir = 'src';
  const appDir = path.join(projectDir, srcDir, 'app');
  const appFunctionsDir = path.join(appDir, 'app.functions');
  const extensionsDir = path.join(appDir, 'exensions');
  const projectName = 'super cool test project';
  const installLocations = [appFunctionsDir, extensionsDir];

  function mockedPromisify(execMock: jest.Mock): typeof util.promisify {
    return jest
      .fn()
      .mockReturnValue(execMock) as unknown as typeof util.promisify;
  }

  const mockedWalk = walk as jest.Mock;
  const mockedGetProjectConfig = getProjectConfig as jest.Mock;

  beforeEach(() => {
    execMock = jest.fn();
    util.promisify = mockedPromisify(execMock);
    mockedGetProjectConfig.mockResolvedValue({
      projectDir,
      projectConfig: {
        srcDir,
        name: projectName,
      },
    });
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

    it('should throw an error when installing the dependencies fails', async () => {
      execMock = jest.fn().mockImplementation(command => {
        if (command !== 'npm --version') {
          throw new Error('OH NO');
        }
      });

      util.promisify = mockedPromisify(execMock);

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

      await expect(() => installPackages({})).rejects.toThrowError(
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

  describe('getProjectPackageJsonFiles()', () => {
    it('should throw an error when ran outside the boundary of a project', async () => {
      mockedGetProjectConfig.mockResolvedValue({});
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        'No project detected. Run this command from a project directory.'
      );
    });

    it('should throw an error if npm is not globally installed', async () => {
      execMock = jest.fn().mockImplementation(() => {
        throw new Error('OH NO');
      });
      util.promisify = mockedPromisify(execMock);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        /This command depends on npm, install/
      );
    });

    it('should throw an error if the project directory does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValueOnce(false);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        new RegExp(
          `No dependencies to install. The project ${projectName} folder might be missing component or subcomponent files.`
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

      const actual = await getProjectPackageJsonLocations();
      expect(actual).toEqual([appFunctionsDir, extensionsDir]);
    });
  });
});
