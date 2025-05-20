import { Argv } from 'yargs';
import { i18n } from '../lib/lang';
import auth from './account/auth';
import list from './account/list';
import rename from './account/rename';
import use from './account/use';
import info from './account/info';
import remove from './account/remove';
import clean from './account/clean';
import createOverride from './account/createOverride';
import removeOverride from './account/removeOverride';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';

const command = ['account', 'accounts'];
const describe = i18n('commands.account.describe');

function accountBuilder(yargs: Argv): Argv {
  yargs
    .command(auth)
    .command(list)
    .command(rename)
    .command(use)
    .command(info)
    .command(remove)
    .command(clean)
    .command(createOverride)
    .command(removeOverride)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(accountBuilder, command, describe);

const accountCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default accountCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = accountCommand;
