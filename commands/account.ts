import { Argv } from 'yargs';
import { commands } from '../lang/en.js';
import auth from './account/auth.js';
import list from './account/list.js';
import rename from './account/rename.js';
import use from './account/use.js';
import info from './account/info.js';
import remove from './account/remove.js';
import clean from './account/clean.js';
import createOverride from './account/createOverride.js';
import removeOverride from './account/removeOverride.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';

const command = ['account', 'accounts'];
const describe = commands.account.describe;

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
