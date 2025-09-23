import yargs, { Argv } from 'yargs';
import createCommand from '../create.js';
import { TEMPLATE_TYPES, HTTP_METHODS } from '../../types/Cms.js';

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const optionSpy = vi
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

      // Template creation flags
      expect(optionSpy).toHaveBeenCalledWith(
        'template-type',
        expect.objectContaining({
          type: 'string',
          choices: [...TEMPLATE_TYPES],
        })
      );

      // Module creation flags
      expect(optionSpy).toHaveBeenCalledWith(
        'module-label',
        expect.objectContaining({ type: 'string' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'react-type',
        expect.objectContaining({ type: 'boolean' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'content-types',
        expect.objectContaining({ type: 'string' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'global',
        expect.objectContaining({ type: 'boolean' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'available-for-new-content',
        expect.objectContaining({ type: 'boolean' })
      );

      // Function creation flags
      expect(optionSpy).toHaveBeenCalledWith(
        'functions-folder',
        expect.objectContaining({ type: 'string' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'filename',
        expect.objectContaining({ type: 'string' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'endpoint-method',
        expect.objectContaining({
          type: 'string',
          choices: [...HTTP_METHODS],
        })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'endpoint-path',
        expect.objectContaining({ type: 'string' })
      );
    });
  });
});
