import yargs, { Argv } from 'yargs';
import createCommand from '../create';

jest.mock('yargs');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const optionSpy = jest
  .spyOn(yargs as Argv, 'option')
  .mockReturnValue(yargs as Argv);

describe('commands/create', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(createCommand.command).toEqual('create <type> [name] [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(createCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      createCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(3);
      expect(positionalSpy).toHaveBeenCalledWith(
        'type',
        expect.objectContaining({ type: 'string' })
      );
      expect(positionalSpy).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({ type: 'string' })
      );
      expect(positionalSpy).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      createCommand.builder(yargs as Argv);

      expect(optionSpy).toHaveBeenCalledWith(
        'internal',
        expect.objectContaining({ type: 'boolean', hidden: true })
      );
    });
  });
});
