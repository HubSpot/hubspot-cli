jest.mock('../../../lib/projects');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/dependencyManagement');
jest.mock('../../../lib/prompts/promptUtils');

const { getProjectConfig } = require('../../../lib/projects');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  installPackages,
  getProjectPackageJsonFiles,
} = require('../../../lib/dependencyManagement');
const { promptUser } = require('../../../lib/prompts/promptUtils');
const {
  command,
  describe: installDepsDescribe,
  builder,
  handler,
} = require('../installDeps');
const path = require('path');

describe('commands/project/installDeps', () => {
  describe('command', () => {
    it('should have the correct command string', () => {
      expect(command).toEqual('install-deps [packages..]');
    });
  });

  describe('describe', () => {
    it('should have the correct description', () => {
      expect(installDepsDescribe).toEqual(
        'Install the dependencies for your project, or add a dependency to a component of a project'
      );
    });
  });

  describe('builder', () => {
    let yargs;
    beforeEach(() => {
      yargs = {
        example: jest.fn().mockImplementation(() => yargs),
      };
    });

    it('should add correct examples', () => {
      builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
      expect(yargs.example).toHaveBeenCalledWith([
        ['$0 project install-deps', 'Install the dependencies for the project'],
        [
          '$0 project install-deps dependency1 dependency2',
          'Add the dependencies to one or more project component',
        ],
      ]);
    });
  });

  describe('handler', () => {
    let processExitSpy;

    beforeEach(() => {
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    it('should handle exceptions', async () => {
      const error = new Error('Something went super wrong');

      getProjectConfig.mockImplementationOnce(() => {
        throw error;
      });

      await handler({});

      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(error);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(error.message);

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config is not defined', async () => {
      getProjectConfig.mockResolvedValueOnce(null);
      await handler({});

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command again from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config has no projectDir', async () => {
      getProjectConfig.mockResolvedValueOnce({ projectDir: null });
      await handler({});

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command again from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config has no projectDir', async () => {
      getProjectConfig.mockResolvedValueOnce({ projectDir: null });
      await handler({});

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command again from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt for input when packages is defined', async () => {
      const projectDir = 'src';
      getProjectConfig.mockResolvedValue({ projectDir });
      const packageJsonLocation = path.join(projectDir, 'directory1');
      promptUser.mockResolvedValueOnce(packageJsonLocation);
      getProjectPackageJsonFiles.mockResolvedValue([packageJsonLocation]);
      await handler({ packages: ['@hubspot/local-dev-lib'] });
      expect(getProjectPackageJsonFiles).toHaveBeenCalledTimes(1);
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
          message: 'Choose where to add the dependencies:',
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
      getProjectPackageJsonFiles.mockResolvedValue(installLocations);
      await handler({ packages });

      expect(installPackages).toHaveBeenCalledTimes(1);
      expect(installPackages).toHaveBeenCalledWith({
        packages,
        installLocations,
      });
    });
  });
});
