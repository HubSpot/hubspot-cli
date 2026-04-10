import { Argv } from 'yargs';
import yargsParser from 'yargs-parser';
import { commands } from '../lang/en.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { CommonArgs, YargsCommandModule } from '../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../lib/yargs/makeYargsHandlerWithUsageTracking.js';
const command = 'completion';
const describe = commands.completion.describe;

async function handler(): Promise<void> {}

function completionBuilder(yargs: Argv): Argv<CommonArgs> {
  const { help } = yargsParser(process.argv.slice(2));

  if (!help) {
    yargs.completion();
  }

  yargs.example([
    ['$0 completion >> ~/.zshrc', commands.completion.examples.default],
  ]);

  return yargs as Argv<CommonArgs>;
}

const builder = makeYargsBuilder(completionBuilder, command, describe);

const completionCommand: YargsCommandModule<unknown, CommonArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('completion', handler),
  builder,
};

export default completionCommand;
