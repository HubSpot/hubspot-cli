// @ts-nocheck
import yargs from 'yargs';

jest.mock('yargs');

// Import this last so mocks apply
import createCommand from '../create';

describe('commands/create', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(createCommand.command).toEqual(
        'create <type> [name] [dest] [--internal]'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(createCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      createCommand.builder(yargs);

      expect(yargs.positional).toHaveBeenCalledTimes(3);
      expect(yargs.positional).toHaveBeenCalledWith(
        'type',
        expect.objectContaining({ type: 'string' })
      );
      expect(yargs.positional).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({ type: 'string' })
      );
      expect(yargs.positional).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      createCommand.builder(yargs);

      expect(yargs.option).toHaveBeenCalledTimes(1);
      expect(yargs.option).toHaveBeenCalledWith(
        'internal',
        expect.objectContaining({ type: 'boolean', hidden: true })
      );
    });
  });
});
