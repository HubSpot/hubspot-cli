import { Argv } from 'yargs';
import createCommand from './hubdb/create';
import fetchCommand from './hubdb/fetch';
import deleteCommand from './hubdb/delete';
import clearCommand from './hubdb/clear';
import { i18n } from '../lib/lang';
import { YargsCommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

export const command = 'hubdb';
export const describe = i18n('commands.hubdb.describe');

function hubdbBuilder(yargs: Argv): Argv {
  yargs
    .command(clearCommand)
    .command(createCommand)
    .command(fetchCommand)
    .command(deleteCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(hubdbBuilder, command, describe);

const hubdbCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default hubdbCommand;
