import { exec } from 'child_process';
import SpinniesManager from '../lib/ui/SpinniesManager';
import util from 'util';

const output = {};

const execAsync = util.promisify(exec);

async function extractCommands(
  toParse: string,
  parent: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commands: Record<string, any>
) {
  for (const line of toParse.split('\n')) {
    const arg = line.split(':')[0];

    if (
      !commands[arg] &&
      !arg.startsWith('-') &&
      arg !== '' &&
      arg !== 'completion'
    ) {
      commands[arg] = {};

      const commandToRun = `hs ${
        parent !== '' ? `${parent} ` : ''
      }${arg}  --get-yargs-completions`;

      const { stdout } = await execAsync(commandToRun);
      await extractCommands(
        stdout,
        `${parent !== '' ? `${parent} ` : ''}${arg}`,
        commands[arg]
      );
    }
  }
  return commands;
}

(async function() {
  SpinniesManager.init();
  SpinniesManager.add('extractingCommands', { text: 'Extracting commands' });

  const { stdout } = await execAsync('hs --get-yargs-completions');
  const result = await extractCommands(stdout, '', output);

  SpinniesManager.succeed('extractingCommands', {
    text: 'Extracting commands',
  });

  console.log(result);
})();
