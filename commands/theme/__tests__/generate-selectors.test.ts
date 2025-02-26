import yargs, { Argv } from 'yargs';
import * as generateSelectorsCommand from '../generate-selectors';

jest.mock('yargs');

describe('commands/theme/generate-selectors', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      positional: jest.fn().mockReturnThis(),
    } as unknown as Argv;
  });

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
      generateSelectorsCommand.builder(yargsMock);

      expect(yargsMock.positional).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith('path', {
        describe: expect.any(String),
        required: true,
        type: 'string',
      });
    });
  });
});
