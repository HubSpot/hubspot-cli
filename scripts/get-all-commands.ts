import { exec } from 'node:child_process';
import SpinniesManager from '../lib/ui/SpinniesManager.ts';
import util from 'util';

const output = {};

const execAsync = util.promisify(exec);

function generateCommand(parent: string, command: string) {
  const parentCommand = parent !== '' ? `${parent} ` : '';
  return `hs ${parentCommand}${command} --get-yargs-completions`;
}

async function extractCommands(
  toParse: string,
  parent: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commands: any
) {
  for (const line of toParse.split('\n')) {
    const [arg] = line.split(':');

    if (
      !commands[arg] &&
      // filter out flags, empty strings from splitting, and the completion command
      // because they lead to infinite loops because they display the root level commands
      // all over again
      !arg.startsWith('-') &&
      arg !== '' &&
      arg !== 'completion'
    ) {
      commands[arg] = {};

      const { stdout } = await execAsync(generateCommand(parent, arg));
      await extractCommands(
        stdout,
        // Concatenate the parent command with the current command to recurse the subcommands
        `${parent !== '' ? `${parent} ` : ''}${arg}`,
        commands[arg]
      );
    }
  }
  return commands;
}

(async function () {
  SpinniesManager.init();
  SpinniesManager.add('extractingCommands', { text: 'Extracting commands' });

  const { stdout } = await execAsync(generateCommand('', ''));
  const result = await extractCommands(stdout, '', output);

  SpinniesManager.succeed('extractingCommands', {
    text: 'Done extracting commands',
  });

  console.log(result);
})();
