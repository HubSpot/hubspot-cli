import { Argv } from 'yargs';
import { i18n } from '../lib/lang';
import { uiBetaTag } from '../lib/ui';
import deploy from './project/deploy';
import create from './project/create';
import upload from './project/upload';
import listBuilds from './project/listBuilds';
import logs from './project/logs';
import watch from './project/watch';
import download from './project/download';
import open from './project/open';
import dev from './project/dev';
import add from './project/add';
import migrate from './project/migrate';
import migrateApp from './project/migrateApp';
import cloneApp from './project/cloneApp';
import installDeps from './project/installDeps';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';

const command = ['project', 'projects'];
const describe = uiBetaTag(i18n(`commands.project.describe`), false);

function projectBuilder(yargs: Argv): Argv {
  yargs
    .command(create)
    .command(add)
    .command(watch)
    .command(dev)
    .command(upload)
    .command(deploy)
    .command(logs)
    .command(listBuilds)
    .command(download)
    .command(open)
    .command(migrateApp)
    .command(migrate)
    .command(cloneApp)
    .command(installDeps)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(projectBuilder, command, describe);

const projectCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default projectCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = projectCommand;
