import yargs, { Argv } from 'yargs';
import openCommand from '../open.js';
import * as commonOpts from '../../lib/commonOpts.js';

vi.mock('../../lib/commonOpts');

// Spies are now safe to create since the methods exist on the mock
const positionalSpy = vi.spyOn(mockYargs, 'positional');
const optionSpy = vi.spyOn(mockYargs, 'option');
const exampleSpy = vi.spyOn(mockYargs, 'example');

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
