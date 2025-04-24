import { Arguments } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../enums/exitCodes';
import { i18n } from '../lang';
import { getIsInProject } from '../projects/config';
import { isTargetedCommand } from './utils';

const UPLOAD_AND_WATCH_COMMANDS = {
  upload: { target: true },
  watch: { target: true },
};

export function performChecks(argv: Arguments<{ src?: string }>): boolean {
  // Require "project" command when running upload/watch inside of a project
  if (
    isTargetedCommand(argv._, UPLOAD_AND_WATCH_COMMANDS) &&
    getIsInProject(argv.src)
  ) {
    logger.error(
      i18n(`commands.generalErrors.srcIsProject`, {
        src: argv.src || './',
        command: argv._.join(' '),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  return true;
}
