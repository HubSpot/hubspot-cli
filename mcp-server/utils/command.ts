import path from 'path';
import fs from 'fs';
import util from 'util';
import { exec, spawn } from 'node:child_process';

export interface Command {
  executable: string;
  args: string[];
}

export type FlagValue = string | number | boolean | string[];

export interface Flag {
  name: string;
  value: FlagValue;
}

export class HubSpotCommand implements Command {
  readonly executable = 'hs';
  private readonly subcommandArgs: string[];
  private readonly positionalArgs: string[];
  private readonly flags: Flag[];

  constructor(subcommand: string, flags: Flag[] = []) {
    this.subcommandArgs = subcommand.trim().split(/\s+/);
    this.positionalArgs = [];
    this.flags = [...flags];
  }

  addArg(value: string): this {
    this.positionalArgs.push(value);
    return this;
  }

  addFlag(name: string, value: FlagValue): this {
    this.flags.push({ name, value });
    return this;
  }

  get args(): string[] {
    return [
      ...this.subcommandArgs,
      ...this.positionalArgs,
      ...this.flags.flatMap(({ name, value }) =>
        Array.isArray(value)
          ? [`--${name}`, ...value.map(String)]
          : [`--${name}`, String(value)]
      ),
    ];
  }
}

export class NpxHubSpotCommand implements Command {
  readonly executable = 'npx';
  readonly args: string[];

  constructor(command: Command, cliPackage = '@hubspot/cli') {
    this.args = ['-y', '-p', cliPackage, 'hs', ...command.args];
  }
}

export const execAsync = util.promisify(exec);

export interface CommandResults {
  stderr: string;
  stdout: string;
}

export async function runCommandInDir(
  directory: string,
  command: Command,
  onData?: (chunk: string, source: 'stdout' | 'stderr') => void
): Promise<CommandResults> {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }

  let finalCommand = command;

  if (command instanceof HubSpotCommand) {
    command.addFlag('disable-usage-tracking', 'true');
    if (process.env.HUBSPOT_MCP_STANDALONE === 'true') {
      const cliPackage = process.env.HUBSPOT_CLI_VERSION
        ? `@hubspot/cli@${process.env.HUBSPOT_CLI_VERSION}`
        : '@hubspot/cli';
      finalCommand = new NpxHubSpotCommand(command, cliPackage);
    }
  }

  const resolvedDir = path.resolve(directory);

  return new Promise((resolve, reject) => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const child = spawn(finalCommand.executable, finalCommand.args, {
      cwd: resolvedDir,
      env: { ...process.env, INIT_CWD: resolvedDir },
    });

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutChunks.push(text);
      onData?.(text, 'stdout');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      onData?.(text, 'stderr');
    });

    child.on('error', reject);
    child.on('close', code => {
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      if (code !== 0) {
        reject(
          Object.assign(
            new Error(
              `Command failed: ${finalCommand.executable} ${finalCommand.args.join(' ')}\n${stderr}`
            ),
            { code, stdout, stderr }
          )
        );
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
