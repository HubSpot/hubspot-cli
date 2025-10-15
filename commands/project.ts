import { Argv } from 'yargs';
import { commands } from '../lang/en.js';
import deploy from './project/deploy.js';
import create from './project/create.js';
import upload from './project/upload.js';
import listBuilds from './project/listBuilds.js';
import logs from './project/logs.js';
import watch from './project/watch.js';
import download from './project/download.js';
import open from './project/open.js';
import dev from './project/dev/index.js';
import add from './project/add.js';
import migrate from './project/migrate.js';
import migrateApp from './project/migrateApp.js';
import cloneApp from './project/cloneApp.js';
import installDeps from './project/installDeps.js';
import profile from './project/profile.js';
import projectValidate from './project/validate.js';
import list from './project/list.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';

const command = ['project', 'projects'];
const describe = commands.project.describe;

function projectBuilder(yargs: Argv): Argv {
  yargs
    .command(create)
    .command(add)
    .command(watch)
    .command(list)
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
    .command(profile)
    .command(projectValidate)
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
