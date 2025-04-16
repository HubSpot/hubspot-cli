import yargs, { Argv } from 'yargs';
import * as openCommand from '../open';
import * as commonOpts from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const optionSpy = jest
  .spyOn(yargs as Argv, 'option')
  .mockReturnValue(yargs as Argv);
const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/open', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(openCommand.command).toBe('open [shortcut]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(openCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      openCommand.builder(yargs as Argv);

      expect(commonOpts.addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addGlobalOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addConfigOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addAccountOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the shortcut positional argument', () => {
      openCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith('[shortcut]', {
        describe: expect.any(String),
        type: 'string',
      });
    });

    it('should add the list option', () => {
      openCommand.builder(yargs as Argv);
      expect(optionSpy).toHaveBeenCalledWith('list', {
        alias: 'l',
        describe: expect.any(String),
        type: 'boolean',
      });
    });

    it('should add examples', () => {
      openCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledWith([
        ['$0 open'],
        ['$0 open --list'],
        ['$0 open settings'],
        ['$0 open settings/navigation'],
        ['$0 open sn'],
      ]);
    });
  });
});
