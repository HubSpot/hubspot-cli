import { Argv } from 'yargs';
import { pkg } from '../lib/jsonLoader.js';
import { commands, lib } from '../lang/en.js';
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
import installDeps from './project/installDeps.js';
import lint from './project/lint.js';
import updateDeps from './project/updateDeps.js';
import profile from './project/profile.js';
import projectValidate from './project/validate.js';
import list from './project/list.js';
import info from './project/info.js';
import deleteProject from './project/delete.js';
import appInstallStatus from './project/appInstallStatus.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { getProjectConfig } from '../lib/projects/config.js';
import {
  isSupportedPlatformVersion,
  LATEST_SUPPORTED_PLATFORM_VERSION,
} from '@hubspot/project-parsing-lib/projects';
import { uiLogger } from '../lib/ui/logger.js';
import { debugError } from '../lib/errorHandlers/index.js';

const command = ['project', 'projects'];
const describe = commands.project.describe;

// Warn users when they are interacting with a version of projects that this version of
// the CLI is not officially compatible with
async function validatePlatformVersion() {
  try {
    const { projectConfig } = await getProjectConfig();

    // Only warn if a platform version is explicitly set but not supported
    // Don't warn if the platform version is missing/undefined
    if (
      projectConfig?.platformVersion &&
      !isSupportedPlatformVersion(projectConfig.platformVersion)
    ) {
      uiLogger.warn(
        lib.projects.platformVersion.unsupported(
          pkg.version,
          LATEST_SUPPORTED_PLATFORM_VERSION,
          projectConfig.platformVersion
        )
      );
      uiLogger.log('');
    }
  } catch (error) {
    // Silently fail. We don't want this to interrupt command execution
    debugError(error);
  }
}

function projectBuilder(yargs: Argv): Argv {
  yargs.middleware([validatePlatformVersion]);

  yargs
    .command(create)
    .command(add)
    .command(deleteProject)
    .command(watch)
    .command(list)
    .command(info)
    .command(dev)
    .command(upload)
    .command(deploy)
    .command(logs)
    .command(listBuilds)
    .command(download)
    .command(open)
    .command(migrate)
    .command(installDeps)
    .command(lint)
    .command(updateDeps)
    .command(profile)
    .command(projectValidate)
    .command(appInstallStatus)
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
