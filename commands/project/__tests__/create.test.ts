import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import projectCreateCommand from '../create.js';

vi.mock('../../../lib/commonOpts');

describe('commands/project/create', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectCreateCommand.command).toEqual(['create', 'init']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectCreateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectCreateCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project creation options', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      const exampleSpy = vi.spyOn(yargsMock, 'example');
      const conflictsSpy = vi.spyOn(yargsMock, 'conflicts');

      projectCreateCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(Object),
          dest: expect.any(Object),
          template: expect.any(Object),
          'template-source': expect.any(Object),
          'platform-version': expect.any(Object),
          'project-base': expect.any(Object),
          distribution: expect.any(Object),
          auth: expect.any(Object),
          features: expect.any(Object),
        })
      );

      expect(conflictsSpy).toHaveBeenCalledWith('template', 'features');
      expect(exampleSpy).toHaveBeenCalled();
    });

    it('should define platform version option with correct choices', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      projectCreateCommand.builder(yargsMock);

      const optionsCall = optionsSpy.mock.calls[0][0];
      expect(optionsCall['platform-version']).toEqual(
        expect.objectContaining({
          describe: 'The target platform version for the new project.',
          type: 'string',
          choices: ['2023.2', '2025.1', '2025.2'],
          default: '2025.2',
        })
      );
    });

    it('should define project base option with correct choices', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      projectCreateCommand.builder(yargsMock);

      const optionsCall = optionsSpy.mock.calls[0][0];
      expect(optionsCall['project-base']).toEqual(
        expect.objectContaining({
          describe: 'The top level component to include in the project.',
          type: 'string',
          choices: ['empty', 'app'],
        })
      );
    });

    it('should define distribution option with correct choices', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      projectCreateCommand.builder(yargsMock);

      const optionsCall = optionsSpy.mock.calls[0][0];
      expect(optionsCall.distribution).toEqual(
        expect.objectContaining({
          describe: 'How the app will be distributed.',
          type: 'string',
          choices: ['private', 'marketplace'],
        })
      );
    });

    it('should define auth option with correct choices', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      projectCreateCommand.builder(yargsMock);

      const optionsCall = optionsSpy.mock.calls[0][0];
      expect(optionsCall.auth).toEqual(
        expect.objectContaining({
          describe: 'Authentication model for the application.',
          type: 'string',
          choices: ['oauth', 'static'],
        })
      );
    });

    it('should define features option as array', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      projectCreateCommand.builder(yargsMock);

      const optionsCall = optionsSpy.mock.calls[0][0];
      expect(optionsCall.features).toEqual(
        expect.objectContaining({
          describe:
            'Features to include in the project. Only valid if project-base is app',
          type: 'array',
        })
      );
    });
  });
});
