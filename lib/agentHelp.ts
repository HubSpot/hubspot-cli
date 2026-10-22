import yargs, { Argv } from 'yargs';
import { z } from 'zod';
import { lib } from '../lang/en.js';
import { indent } from './ui/index.js';
import { debugError } from './errorHandlers/index.js';
import { getJsonOutputSchema } from './yargs/makeWrappedYargsHandler.js';

type Workflow = (typeof lib.agentHelp.workflows)[number];

type CommandModule = {
  command?: string | readonly string[];
  describe?: string | false;
  builder?: unknown;
  handler?: unknown;
};

const { agentHelp } = lib;

function formatSection(heading: string, lines: string[]): string {
  return [heading, ...lines.map(line => `${indent(1)}${line}`)].join('\n');
}

function formatWorkflows(workflows: Workflow[]): string {
  return formatSection(
    agentHelp.headings.workflows,
    workflows.flatMap(({ title, steps }) => [
      title,
      ...steps.flatMap(({ command, description }, index) => [
        `${indent(1)}${index + 1}. ${command}`,
        `${indent(2)} ${description}`,
      ]),
    ])
  );
}

export function recordCommands(instance: Argv): CommandModule[] {
  const commands: CommandModule[] = [];
  const { command } = instance;

  Object.assign(instance, {
    command(...args: unknown[]) {
      const [module] = args;
      if (typeof module === 'object' && module !== null) {
        commands.push(module);
      }
      return Reflect.apply(command, instance, args);
    },
  });

  return commands;
}

type VisitedCommand = {
  module: CommandModule;
  commandPath: string[];
  usage: string;
};

export async function walkCommands(
  modules: CommandModule[],
  visit: (command: VisitedCommand) => void,
  parentPath: string[] = []
): Promise<void> {
  for (const module of modules) {
    const [commandString = ''] = [module.command ?? []].flat();
    const commandPath = [...parentPath, commandString.split(' ')[0]];
    visit({
      module,
      commandPath,
      usage: ['hs', ...parentPath, commandString].join(' '),
    });

    const instance = yargs([]);
    const subcommands = recordCommands(instance);
    try {
      if (typeof module.builder === 'function') {
        await module.builder(instance);
      }
    } catch (e) {
      debugError(e);
    }
    await walkCommands(subcommands, visit, commandPath);
  }
}

function joinSections(sections: Array<string | false>): string {
  return sections.filter(Boolean).join('\n\n');
}

function formatExitCodes(): string {
  return formatSection(agentHelp.headings.exitCodes, [agentHelp.exitCodes]);
}

export async function getRootAgentHelp(
  rootCommands: CommandModule[]
): Promise<string> {
  const commandLines: string[] = [];
  await walkCommands(rootCommands, ({ module, usage }) => {
    if (typeof module.describe === 'string') {
      commandLines.push(
        `- ${usage}: ${module.describe.replace(/\s*\n\s*/g, ' ')}`
      );
    }
  });

  return joinSections([
    formatSection(
      agentHelp.headings.conventions,
      agentHelp.conventions.map(convention => `- ${convention}`)
    ),
    formatWorkflows(agentHelp.workflows),
    formatSection(agentHelp.headings.commands, commandLines),
    formatExitCodes(),
  ]);
}

export function getCommandAgentHelp(command: string, helpText: string): string {
  const jsonOutputSchema = getJsonOutputSchema(
    command.replace(/^hs /, '').replaceAll(' ', '-')
  );
  const workflows = agentHelp.workflows.filter(({ steps }) =>
    steps.some(step => `${step.command} `.startsWith(`${command} `))
  );

  return joinSections([
    helpText.includes('--json') &&
      formatSection(
        agentHelp.headings.jsonOutput,
        jsonOutputSchema
          ? [
              agentHelp.jsonOutput.schema,
              ...JSON.stringify(
                z.toJSONSchema(jsonOutputSchema),
                null,
                2
              ).split('\n'),
            ]
          : [agentHelp.jsonOutput.noSchema]
      ),
    workflows.length > 0 && formatWorkflows(workflows),
    formatExitCodes(),
  ]);
}
