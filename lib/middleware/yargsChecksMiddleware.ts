import { Arguments } from 'yargs';
import { uiLogger } from '../ui/logger.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { commands } from '../../lang/en.js';
import { getIsInProject } from '../projects/config.js';
import { isTargetedCommand } from './commandTargetingUtils.js';

const UPLOAD_AND_WATCH_COMMANDS = {
  upload: true,
  watch: true,
};

export function performChecks(argv: Arguments<{ src?: string }>): boolean {
  // Require "project" command when running upload/watch inside of a project
  if (
    isTargetedCommand(argv._, UPLOAD_AND_WATCH_COMMANDS) &&
    getIsInProject(argv.src)
  ) {
    uiLogger.error(
      commands.generalErrors.srcIsProject(argv.src || './', argv._.join(' '))
    );
    process.exit(EXIT_CODES.ERROR);
  }

  return true;
}
