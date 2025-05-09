import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import { trackCommandUsage } from '../lib/usageTracking';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { GetStarted } from '../lib/getStarted/GetStarted';

export const command = 'get-started';
export const describe = undefined;

export async function handler(): Promise<void> {
  trackCommandUsage('get-started');

  const getStarted = new GetStarted();

  getStarted.welcomePrompt();
  await getStarted.checkConfig();
  await getStarted.initializeApp();

  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  return yargs;
}
