import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { logger } from '@hubspot/local-dev-lib/logger';
import * as projectUtils from '../../../lib/projects/config';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { trackCommandUsage } from '../../../lib/usageTracking';
import * as dependencyManagement from '../../../lib/dependencyManagement';
import * as promptUtils from '../../../lib/prompts/promptUtils';
import * as projectInstallDepsCommand from '../installDeps';

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/projects/config');
jest.mock('../../../lib/dependencyManagement');
jest.mock('../../../lib/prompts/promptUtils');
jest.mock('../../../lib/usageTracking');
jest.mock('../../../lib/commonOpts');

const exampleSpy = jest.spyOn(yargs as Argv, 'example');
const processExitSpy = jest.spyOn(process, 'exit');
const getProjectConfigSpy = jest.spyOn(projectUtils, 'getProjectConfig');
const promptUserSpy = jest.spyOn(promptUtils, 'promptUser');
const getProjectPackageJsonLocationsSpy = jest.spyOn(
  dependencyManagement,
  'getProjectPackageJsonLocations'
);
const installPackagesSpy = jest.spyOn(dependencyManagement, 'installPackages');

describe('commands/project/installDeps', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectInstallDepsCommand.command).toEqual(
        'install-deps [packages..]'
      );
    });
  });

  describe('describe', () => {
    it('should not provide a description', () => {
      expect(projectInstallDepsCommand.describe).toEqual(
        expect.stringMatching(
          /Install the dependencies for your project, or add a dependency to a subcomponent of a project/
        )
      );
    });
  });

  describe('builder', () => {
    it('should provide examples', () => {
      projectInstallDepsCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<projectInstallDepsCommand.ProjectInstallDepsArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: 999999,
      } as ArgumentsCamelCase<projectInstallDepsCommand.ProjectInstallDepsArgs>;
      // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
      processExitSpy.mockImplementation(() => {});
    });

    it('should track the command usage', async () => {
      await projectInstallDepsCommand.handler(args);

      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-install-deps',
        undefined,
        args.derivedAccountId
      );
    });

    it('should handle exceptions', async () => {
      const error = new Error('Something went super wrong');
      getProjectConfigSpy.mockImplementationOnce(() => {
        throw error;
      });

      await projectInstallDepsCommand.handler(args);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(error.message);

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config is not defined', async () => {
      getProjectConfigSpy.mockResolvedValueOnce({
        projectDir: null,
        projectConfig: null,
      });
      await projectInstallDepsCommand.handler(args);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config has no projectDir', async () => {
      getProjectConfigSpy.mockResolvedValueOnce({
        projectDir: null,
        projectConfig: null,
      });
      await projectInstallDepsCommand.handler(args);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'No project detected. Run this command from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt for input when packages is defined', async () => {
      const projectDir = 'src';
      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      const packageJsonLocation = path.join(projectDir, 'directory1');
      promptUserSpy.mockResolvedValueOnce({
        selectedInstallLocations: packageJsonLocation,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        packageJsonLocation,
      ]);

      await projectInstallDepsCommand.handler({
        ...args,
        packages: ['@hubspot/local-dev-lib'],
      });
      expect(getProjectPackageJsonLocationsSpy).toHaveBeenCalledTimes(1);
      expect(promptUserSpy).toHaveBeenCalledTimes(1);
      expect(promptUserSpy).toHaveBeenCalledWith([
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

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      promptUserSpy.mockResolvedValueOnce({
        selectedInstallLocations: packageJsonLocation,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue(installLocations);

      await projectInstallDepsCommand.handler({ ...args, packages });

      expect(installPackagesSpy).toHaveBeenCalledTimes(1);
      expect(installPackagesSpy).toHaveBeenCalledWith({
        packages,
        installLocations: packageJsonLocation,
      });
    });
  });
});
