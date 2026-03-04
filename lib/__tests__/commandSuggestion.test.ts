import { Mock } from 'vitest';
import yargs, { Argv } from 'yargs';
import {
  addCommandSuggestions,
  commandSuggestionMappings,
} from '../commandSuggestion.js';
import { uiLogger } from '../ui/logger.js';
import { uiCommandReference } from '../ui/index.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { YargsCommandModule } from '../../types/Yargs.js';

vi.mock('../ui/logger.js');
vi.mock('../ui/index.js');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);

describe('lib/commandSuggestion', () => {
  const uiLoggerErrorMock = uiLogger.error as Mock;
  const uiCommandReferenceMock = uiCommandReference as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    commandSpy.mockClear();
    uiCommandReferenceMock.mockImplementation(
      (command: string) => `\`${command}\``
    );
  });

  describe('addCommandSuggestions', () => {
    it('adds all command suggestions to yargs instance', () => {
      addCommandSuggestions(yargs as Argv);

      expect(commandSpy).toHaveBeenCalledTimes(
        Object.keys(commandSuggestionMappings).length
      );
    });

    it('registers each mapping from commandSuggestionMappings', () => {
      addCommandSuggestions(yargs as Argv);

      Object.entries(commandSuggestionMappings).forEach(([oldCommand]) => {
        expect(commandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: oldCommand,
          })
        );
      });
    });

    it('returns the yargs instance', () => {
      const yargsInstance = yargs as Argv;
      const result = addCommandSuggestions(yargsInstance);

      expect(result).toBe(yargsInstance);
    });

    it('creates command modules with handler that logs error and exits', () => {
      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error(`process.exit called with ${EXIT_CODES.ERROR}`);
      });

      addCommandSuggestions(yargs as Argv);

      // Get the first registered command module
      const firstCall = commandSpy.mock.calls[0];
      const commandModule = firstCall[0] as unknown as YargsCommandModule<
        unknown,
        object
      >;
      const firstMapping = Object.entries(commandSuggestionMappings)[0];
      const [, newCommand] = firstMapping;

      // Verify the command module structure
      expect(commandModule).toHaveProperty('command');
      expect(commandModule).toHaveProperty('handler');
      expect(commandModule).toHaveProperty('builder');

      // Invoke the handler to verify behavior
      expect(() => {
        commandModule.handler({} as never);
      }).toThrow('process.exit called');

      expect(uiCommandReferenceMock).toHaveBeenCalledWith(newCommand);
      expect(uiLoggerErrorMock).toHaveBeenCalledWith(
        `Did you mean \`${newCommand}\`?`
      );
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);

      vi.restoreAllMocks();
    });

    it('creates command modules with builder that sets strict mode to false', async () => {
      const yargsInstance = yargs as Argv;
      const commandSpyForTest = vi
        .spyOn(yargsInstance, 'command')
        .mockReturnValue(yargsInstance);

      addCommandSuggestions(yargsInstance);

      // Get a command module and verify it has a builder
      const firstCall = commandSpyForTest.mock.calls[0];
      const commandModule = firstCall[0] as unknown as YargsCommandModule<
        unknown,
        object
      >;

      expect(commandModule).toHaveProperty('builder');
      expect(typeof commandModule.builder).toBe('function');

      // Create a mock yargs builder with strict method
      const mockYargsBuilder = {
        strict: vi.fn().mockReturnThis(),
      } as unknown as Argv;

      await commandModule.builder(mockYargsBuilder);

      expect(mockYargsBuilder.strict).toHaveBeenCalledWith(false);

      commandSpyForTest.mockRestore();
    });

    it('handles commands with multiple words', () => {
      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error(`process.exit called with ${EXIT_CODES.ERROR}`);
      });

      // Find a multi-word command
      const multiWordCommand = Object.entries(commandSuggestionMappings).find(
        ([oldCommand]) => oldCommand.includes(' ')
      );

      expect(multiWordCommand).toBeDefined();

      if (multiWordCommand) {
        const [oldCommand, newCommand] = multiWordCommand;

        const yargsInstance = yargs as Argv;
        const commandSpyForTest = vi
          .spyOn(yargsInstance, 'command')
          .mockReturnValue(yargsInstance);

        addCommandSuggestions(yargsInstance);

        // Find the call for this multi-word command
        const call = commandSpyForTest.mock.calls.find(
          call =>
            (call[0] as unknown as YargsCommandModule<unknown, object>)
              .command === oldCommand
        );

        expect(call).toBeDefined();
        const commandModule = call![0] as unknown as YargsCommandModule<
          unknown,
          object
        >;
        expect(commandModule).toHaveProperty('handler');

        // Invoke handler to verify it works with multi-word commands
        expect(() => {
          commandModule.handler({} as never);
        }).toThrow('process.exit called');

        expect(uiCommandReferenceMock).toHaveBeenCalledWith(newCommand);
        expect(uiLoggerErrorMock).toHaveBeenCalledWith(
          `Did you mean \`${newCommand}\`?`
        );

        commandSpyForTest.mockRestore();
      }

      vi.restoreAllMocks();
    });
  });

  describe('commandSuggestionMappings', () => {
    it('all mappings point to valid new commands', () => {
      Object.entries(commandSuggestionMappings).forEach(([, newCommand]) => {
        expect(newCommand).toMatch(/^hs /);
        expect(typeof newCommand).toBe('string');
        expect(newCommand.length).toBeGreaterThan(0);
      });
    });
  });
});
