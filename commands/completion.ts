import { Argv } from 'yargs';
import yargsParser from 'yargs-parser';
import { i18n } from '../lib/lang';
import { trackCommandUsage } from '../lib/usageTracking';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { CommonArgs, YargsCommandModule } from '../types/Yargs';

const command = 'completion';
const describe = i18n('commands.completion.describe');

async function handler(): Promise<void> {
  await trackCommandUsage('completion');
}

function completionBuilder(yargs: Argv): Argv<CommonArgs> {
  const { help } = yargsParser(process.argv.slice(2));

  if (!help) {
    yargs.completion();
  }

  yargs.example([
    ['$0 completion >> ~/.zshrc', i18n('commands.completion.examples.default')],
  ]);

  return yargs as Argv<CommonArgs>;
}

const builder = makeYargsBuilder(completionBuilder, command, describe);

const completionCommand: YargsCommandModule<unknown, CommonArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default completionCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = completionCommand;
