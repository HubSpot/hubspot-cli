jest.mock('../projects');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/fs');
jest.mock('../ui/SpinniesManager');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
}));

const util = require('util');
const {
  isGloballyInstalled,
  installPackages,
  getProjectPackageJsonLocations,
} = require('../dependencyManagement');
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('path');
const { getProjectConfig } = require('../projects');
const SpinniesManager = require('../ui/SpinniesManager');
const { existsSync } = require('fs');

describe('cli/lib/dependencyManagement', () => {
  let execMock;

  const projectDir = path.join('path', 'to', 'project');
  const srcDir = 'src';
  const appDir = path.join(projectDir, srcDir, 'app');
  const appFunctionsDir = path.join(appDir, 'app.functions');
  const extensionsDir = path.join(appDir, 'exensions');

  beforeEach(() => {
    execMock = jest.fn();
    util.promisify = jest.fn().mockReturnValue(execMock);
    getProjectConfig.mockResolvedValue({
      projectDir,
      projectConfig: {
        srcDir,
      },
    });
  });

  describe('isGloballyInstalled', () => {
    it('should return true when exec is successful', async () => {
      const actual = await isGloballyInstalled('npm');
      expect(actual).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith('npm --version');
    });

    it('should return false when exec is unsuccessful', async () => {
      execMock = jest.fn().mockImplementationOnce(() => {
        throw new Error('unsuccessful');
      });
      util.promisify = jest.fn().mockReturnValueOnce(execMock);
      const actual = await isGloballyInstalled('npm');
      expect(actual).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith('npm --version');
    });
  });

  describe('installPackages', () => {
    it('should setup a loading spinner', async () => {
      const packages = ['package1', 'package2'];
      const installLocations = ['src/app/app.functions', 'src/app/extensions'];
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
      const installLocations = ['src/app/app.functions', 'src/app/extensions'];
      await installPackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(
          `npm --prefix=${location} install package1 package2`
        );
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
      const installLocations = ['src/app/app.functions', 'src/app/extensions'];
      await installPackages({ installLocations });
      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(execMock).toHaveBeenCalledWith(
        `npm --prefix=${installLocations[0]} install`
      );
      expect(execMock).toHaveBeenCalledWith(
        `npm --prefix=${installLocations[1]} install`
      );
    });

    it('should locate the projects package.json files when install locations is not provided', async () => {
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
      ];

      walk.mockResolvedValue(installLocations);

      getProjectConfig.mockResolvedValue({
        projectDir,
        projectConfig: {
          srcDir,
        },
      });

      await installPackages({});
      // Its called once per each install location, plus once to check if npm installed
      expect(execMock).toHaveBeenCalledTimes(installLocations.length + 1);
      expect(execMock).toHaveBeenCalledWith(
        `npm --prefix=${appFunctionsDir} install`
      );
      expect(execMock).toHaveBeenCalledWith(
        `npm --prefix=${extensionsDir} install`
      );
    });

    it('should throw an error when installing the dependencies fails', async () => {
      execMock = jest.fn().mockImplementation(command => {
        if (command !== 'npm --version') {
          throw new Error('OH NO');
        }
      });

      util.promisify = jest.fn().mockReturnValue(execMock);

      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
      ];

      walk.mockResolvedValue(installLocations);

      getProjectConfig.mockResolvedValue({
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

  describe('getProjectPackageJsonFiles', () => {
    it('should throw an error when ran outside the boundary of a project', async () => {
      getProjectConfig.mockResolvedValue({});
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        'No project detected. Run this command from a project directory.'
      );
    });

    it('should throw an error if npm is not globally installed', async () => {
      execMock = jest.fn().mockImplementation(() => {
        throw new Error('OH NO');
      });
      util.promisify = jest.fn().mockReturnValue(execMock);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        /This command depends on npm, install/
      );
    });

    it('should throw an error if the project directory does not exist', async () => {
      existsSync.mockReturnValueOnce(false);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        'No dependencies to install. The project  folder might be missing component or subcomponent files. Learn how to create a project from scratch.: https://developers.hubspot.com/beta-docs/guides/crm/intro/create-a-project'
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

      walk.mockResolvedValue(installLocations);

      const actual = await getProjectPackageJsonLocations();
      expect(actual).toEqual([appFunctionsDir, extensionsDir]);
    });

    it('should throw an error if no package.json files are found', async () => {
      walk.mockResolvedValue([]);

      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        'No dependencies to install. The project  folder might be missing component or subcomponent files. Learn how to create a project from scratch.: https://developers.hubspot.com/beta-docs/guides/crm/intro/create-a-project'
      );
    });
  });
});
