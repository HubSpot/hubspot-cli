import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { z } from 'zod';
import { lib } from '../../lang/en.js';
import {
  getJsonOutputSchema,
  makeWrappedYargsHandler,
} from '../yargs/makeWrappedYargsHandler.js';
import {
  getCommandAgentHelp,
  getRootAgentHelp,
  recordCommands,
  walkCommands,
} from '../agentHelp.js';

vi.unmock('yargs');

const { handlersWithSchema } = vi.hoisted(() => ({
  handlersWithSchema: new Set<unknown>(),
}));

vi.mock('../yargs/makeWrappedYargsHandler.js', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../yargs/makeWrappedYargsHandler.js')
    >();
  return {
    ...actual,
    makeWrappedYargsHandler: (
      ...args: Parameters<typeof actual.makeWrappedYargsHandler>
    ) => {
      const handler = actual.makeWrappedYargsHandler(...args);
      if (args[2]?.jsonOutputSchema) {
        handlersWithSchema.add(handler);
      }
      return handler;
    },
  };
});

const [authWorkflow, , , developWorkflow] = lib.agentHelp.workflows;

const thingCommand = {
  command: ['thing', 'things'],
  describe: 'Commands for managing things',
  builder: async (thingYargs: ReturnType<typeof yargs>) =>
    thingYargs
      .command({
        command: 'upload <src>',
        describe: 'Upload a thing',
        handler: () => {},
      })
      .command({ command: 'internal', describe: false, handler: () => {} }),
};

describe('lib/agentHelp', () => {
  describe('recordCommands()', () => {
    it('should record the command modules registered on an instance', () => {
      const instance = yargs([]);
      const commands = recordCommands(instance);

      instance.command({ ...thingCommand, handler: () => {} });

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toEqual(['thing', 'things']);
    });
  });

  describe('getRootAgentHelp()', () => {
    it('should include the conventions, workflows, and every visible command', async () => {
      const output = await getRootAgentHelp([thingCommand]);

      lib.agentHelp.conventions.forEach(convention =>
        expect(output).toContain(`  - ${convention}`)
      );
      lib.agentHelp.workflows.forEach(({ title }) =>
        expect(output).toContain(`  ${title}`)
      );
      expect(output).toContain(
        '  - hs thing: Commands for managing things\n  - hs thing upload <src>: Upload a thing'
      );
      expect(output).not.toContain('hs thing internal');
      expect(output).toContain(lib.agentHelp.exitCodes);
    });
  });

  describe('getCommandAgentHelp()', () => {
    it('should include the JSON Schema of the command', () => {
      makeWrappedYargsHandler('thing-upload', vi.fn(), {
        jsonOutputSchema: z.object({ buildId: z.number() }),
      });

      const output = getCommandAgentHelp('hs thing upload', '--json');

      expect(output).toContain(lib.agentHelp.jsonOutput.schema);
      expect(output).toContain('"buildId": {');
    });

    it('should include the related workflows and exit codes', () => {
      const output = getCommandAgentHelp('hs project upload', 'Options:');

      expect(output).toContain(`  ${developWorkflow.title}`);
      expect(output).not.toContain(authWorkflow.title);
      expect(output).toContain(lib.agentHelp.exitCodes);
    });

    it('should note when a JSON command has no schema', () => {
      expect(getCommandAgentHelp('hs api', '--json')).toContain(
        lib.agentHelp.jsonOutput.noSchema
      );
    });

    it('should leave out the JSON section and unrelated workflows', () => {
      const output = getCommandAgentHelp('hs project up', 'Options:');

      expect(output).not.toContain(lib.agentHelp.headings.jsonOutput);
      expect(output).not.toContain(lib.agentHelp.headings.workflows);
      expect(output).toContain(lib.agentHelp.exitCodes);
    });
  });

  describe('JSON schema lookup', () => {
    it('should find the schema of every command by its command path', async () => {
      const commandsDir = path.join(__dirname, '../../commands');
      const topLevelCommands = await Promise.all(
        fs
          .readdirSync(commandsDir)
          .filter(file => file.endsWith('.ts'))
          .map(
            async file => (await import(path.join(commandsDir, file))).default
          )
      );
      const missing: string[] = [];
      let found = 0;

      await walkCommands(topLevelCommands, ({ module, commandPath }) => {
        if (!handlersWithSchema.has(module.handler)) {
          return;
        }
        found += 1;
        if (!getJsonOutputSchema(commandPath.join('-'))) {
          missing.push(`hs ${commandPath.join(' ')}`);
        }
      });

      expect(found).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  });
});
