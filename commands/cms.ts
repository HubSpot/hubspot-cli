import { Argv } from 'yargs';
import { commands } from '../lang/en.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import lighthouseScore from './cms/lighthouseScore.js';
import convertFields from './cms/convertFields.js';
import getReactModule from './cms/getReactModule.js';

const command = 'cms';
const describe = commands.cms.describe;

function cmsBuilder(yargs: Argv): Argv {
  yargs
    .command(lighthouseScore)
    .command(convertFields)
    .command(getReactModule)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(cmsBuilder, command, describe);

const cmsCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default cmsCommand;
