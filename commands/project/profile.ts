import { Argv } from 'yargs';
import { uiBetaTag } from '../../lib/ui';
import add from './profile/add';
import remove from './profile/remove';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../../types/Yargs';
import { commands } from '../../lang/en';

const command = ['profile', 'profiles'];
const describe = uiBetaTag(commands.project.profile.describe, false);

function projectProfileBuilder(yargs: Argv): Argv {
  yargs.command(add).command(remove).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(projectProfileBuilder, command, describe);

const projectProfileCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default projectProfileCommand;
