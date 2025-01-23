// @ts-nocheck
const yargs = require('yargs');
const path = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('../../../lib/projects');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  installPackages,
  getProjectPackageJsonLocations,
} = require('../../../lib/dependencyManagement');
const { promptUser } = require('../../../lib/prompts/promptUtils');

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/projects');
jest.mock('../../../lib/dependencyManagement');
jest.mock('../../../lib/prompts/promptUtils');
jest.mock('../../../lib/usageTracking');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
const installDepsCommand = require('../installDeps');

describe('commands/project/installDeps', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(installDepsCommand.command).toEqual('install-deps [packages..]');
    });
  });

  describe('describe', () => {
    it('should not provide a description', () => {
      expect(installDepsCommand.describe).toEqual(
        expect.stringMatching(
          /Install the dependencies for your project, or add a dependency to a subcomponent of a project/
        )
      );
    });
  });

  describe('builder', () => {
    it('should provide examples', () => {
      installDepsCommand.builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    let processExitSpy;

    beforeEach(() => {
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    it('should track the command usage', async () => {
      const accountId = 999999;
      await installDepsCommand.handler({ derivedAccountId: accountId });

      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-install-deps',
        null,
        accountId
      );
    });

    it('should handle exceptions', async () => {
      const error = new Error('Something went super wrong');

      getProjectConfig.mockImplementationOnce(() => {
        throw error;
      });

      await installDepsCommand.handler({});

      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(error);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(error.message);

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config is not defined', async () => {
      getProjectConfig.mockResolvedValueOnce(null);
      await installDepsCommand.handler({});

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config has no projectDir', async () => {
      getProjectConfig.mockResolvedValueOnce({ projectDir: null });
      await installDepsCommand.handler({});

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt for input when packages is defined', async () => {
      const projectDir = 'src';
      getProjectConfig.mockResolvedValue({ projectDir });
      const packageJsonLocation = path.join(projectDir, 'directory1');
      promptUser.mockResolvedValueOnce(packageJsonLocation);
      getProjectPackageJsonLocations.mockResolvedValue([packageJsonLocation]);
      await installDepsCommand.handler({
        packages: ['@hubspot/local-dev-lib'],
      });
      expect(getProjectPackageJsonLocations).toHaveBeenCalledTimes(1);
      expect(promptUser).toHaveBeenCalledTimes(1);
      expect(promptUser).toHaveBeenCalledWith([
        {
          name: 'selectedInstallLocations',
          type: 'checkbox',
          when: expect.any(Function),
          choices: [
            {
              name: 'directory1',
              value: packageJsonLocation,
            },
          ],
          message: 'Choose the project components to install the dependencies:',
          validate: expect.any(Function),
        },
      ]);
    });

    it('should call installPackages correctly', async () => {
      const projectDir = 'src';
      const packageJsonLocation = path.join(projectDir, 'directory1');
      const installLocations = [packageJsonLocation];
      const packages = ['@hubspot/local-dev-lib'];

      getProjectConfig.mockResolvedValue({ projectDir });
      promptUser.mockResolvedValueOnce(packageJsonLocation);
      getProjectPackageJsonLocations.mockResolvedValue(installLocations);
      await installDepsCommand.handler({ packages });

      expect(installPackages).toHaveBeenCalledTimes(1);
      expect(installPackages).toHaveBeenCalledWith({
        packages,
        installLocations,
      });
    });
  });
});
