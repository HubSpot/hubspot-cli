import { Argv } from 'yargs';
import schemaCommand from './customObject/schema.js';
import createCommand from './customObject/create.js';
import createSchemaCommand from './customObject/createSchema.js';
import deleteSchemaCommand from './customObject/deleteSchema.js';
import fetchSchemaCommand from './customObject/fetchSchema.js';
import fetchAllSchemasCommand from './customObject/fetchAllSchemas.js';
import listSchemasCommand from './customObject/listSchemas.js';
import updateSchemaCommand from './customObject/updateSchema.js';
import { commands } from '../lang/en.js';
import { uiBetaTag } from '../lib/ui/index.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { uiLogger } from '../lib/ui/logger.js';

const command = ['custom-object', 'custom-objects', 'co'];
const describe = uiBetaTag(commands.customObject.describe, false);

function logBetaMessage() {
  uiBetaTag(commands.customObject.betaMessage);
  uiLogger.log(commands.customObject.seeMoreLink);
}

function customObjectBuilder(yargs: Argv): Argv {
  yargs.middleware([logBetaMessage]);

  yargs
    .command(schemaCommand)
    .command(createCommand)
    .command(createSchemaCommand)
    .command(deleteSchemaCommand)
    .command(fetchSchemaCommand)
    .command(fetchAllSchemasCommand)
    .command(listSchemasCommand)
    .command(updateSchemaCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(customObjectBuilder, command, describe);

const customObjectCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default customObjectCommand;
