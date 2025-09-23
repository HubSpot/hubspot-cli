import { Argv } from 'yargs';
import createTestAccountCommand from './testAccount/create.js';
import createTestAccountConfigCommand from './testAccount/createConfig.js';
import importDataCommand from './testAccount/importData.js';
import deleteTestAccountCommand from './testAccount/delete.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = ['test-account', 'test-accounts'];
const describe = commands.testAccount.describe;

function testAccountBuilder(yargs: Argv): Argv {
  yargs
    .command(createTestAccountCommand)
    .command(createTestAccountConfigCommand)
    .command(deleteTestAccountCommand)
    .command(importDataCommand)
    .demandCommand(1, '');
  return yargs;
}

const builder = makeYargsBuilder(
  testAccountBuilder,
  command,
  commands.testAccount.describe
);

const testAccountCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default testAccountCommand;
