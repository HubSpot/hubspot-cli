import path from 'path';
import fs from 'fs';
import util from 'util';
import { exec } from 'node:child_process';

export const execAsync = util.promisify(exec);

export function addFlag(
  command: string,
  flagName: string,
  value: string | number | boolean | string[]
): string {
  if (Array.isArray(value)) {
    return `${command} --${flagName} ${value.map(item => `"${item}"`).join(' ')}`;
  }
  return `${command} --${flagName} "${value}"`;
}

export interface CommandResults {
  stderr: string;
  stdout: string;
}

export async function runCommandInDir(
  directory: string,
  command: string
): Promise<CommandResults> {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }

  let finalCommand = command;

  if (command.startsWith('hs ')) {
    // Check if running in standalone mode
    if (process.env.HUBSPOT_MCP_STANDALONE === 'true') {
      const cliPackage = process.env.HUBSPOT_CLI_VERSION
        ? `@hubspot/cli@${process.env.HUBSPOT_CLI_VERSION}`
        : '@hubspot/cli';
      finalCommand = command.replace(/^hs /, `npx -y -p ${cliPackage} hs `);
    }
    finalCommand = addFlag(finalCommand, 'disable-usage-tracking', true);
  }

  return execAsync(finalCommand, {
    cwd: path.resolve(directory),
    env: {
      ...process.env,
    },
  });
}
