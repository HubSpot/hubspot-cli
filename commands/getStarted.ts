import { Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { addGlobalOptions } from '../lib/commonOpts';
import { trackCommandUsage } from '../lib/usageTracking';
import { EXIT_CODES } from '../lib/enums/exitCodes';

export const command = 'get-started';
export const describe = undefined;

export function handler(): void {
  trackCommandUsage('get-started');

  const now = new Date();
  logger.log('Welcome to HubSpot CLI!');
  logger.log(`The current time is: ${now.toLocaleString()}`);
  logger.log('More features coming soon...');

  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  return yargs;
}
