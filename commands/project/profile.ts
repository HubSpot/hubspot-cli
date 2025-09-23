import { Argv } from 'yargs';
import add from './profile/add.js';
import deleteProfile from './profile/delete.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { commands } from '../../lang/en.js';

const command = ['profile', 'profiles'];
const describe = commands.project.profile.describe;
const verboseDescribe = commands.project.profile.verboseDescribe;

function projectProfileBuilder(yargs: Argv): Argv {
  yargs.command(add).command(deleteProfile).demandCommand(1, '');

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
