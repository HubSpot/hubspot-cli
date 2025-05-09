import { Argv } from 'yargs';
import { i18n } from '../lib/lang';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';
import lighthouseScore from './cms/lighthouseScore';
import convertFields from './cms/convertFields';
import getReactModule from './cms/getReactModule';

const command = 'cms';
const describe = i18n(`commands.cms.describe`);

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

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = cmsCommand;
