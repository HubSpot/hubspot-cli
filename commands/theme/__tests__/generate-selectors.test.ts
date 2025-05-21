import yargs, { Argv } from 'yargs';
import generateSelectorsCommand from '../generate-selectors';

jest.mock('yargs');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/theme/generate-selectors', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(generateSelectorsCommand.command).toEqual(
        'generate-selectors <path>'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(generateSelectorsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      generateSelectorsCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith('path', {
        describe: expect.any(String),
        required: true,
        type: 'string',
      });
    });
  });
});
