import { addFlag, execAsync } from './command.js';
import path from 'path';
import fs from 'fs';

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
    finalCommand = addFlag(finalCommand, 'disable-usage-tracking', true);
  }

  return execAsync(finalCommand, {
    cwd: path.resolve(directory),
    env: {
      ...process.env,
    },
  });
}
