import { Argv } from 'yargs';
import { uiBetaTag } from '../../lib/ui';
import add from './profile/add';
import remove from './profile/remove';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../../types/Yargs';
import { commands } from '../../lang/en';

const command = ['profile', 'profiles'];
const describe = undefined; // uiBetaTag(commands.project.profile.describe, false);
const verboseDescribe = uiBetaTag(
  commands.project.profile.verboseDescribe,
  false
);

function projectProfileBuilder(yargs: Argv): Argv {
  yargs.command(add).command(remove).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(
  projectProfileBuilder,
  command,
  verboseDescribe
);

const projectProfileCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default projectProfileCommand;
