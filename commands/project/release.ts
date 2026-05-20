import { Argv } from 'yargs';
import create from './release/create.js';
import info from './release/info.js';
import list from './release/list.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
// import { commands } from '../../lang/en.js';

const command = 'release';
// const describe = commands.project.release.describe;
const describe = undefined;

function projectReleaseBuilder(yargs: Argv): Argv {
  yargs.command(create).command(info).command(list).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(projectReleaseBuilder, command, describe);

const projectReleaseCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default projectReleaseCommand;
