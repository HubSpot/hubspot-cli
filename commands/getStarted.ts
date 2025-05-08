import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { setLogLevel } from '../lib/commonOpts';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { trackCommandUsage } from '../lib/usageTracking';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { CommonArgs, ConfigArgs } from '../types/Yargs';

export const command = 'get-started';
export const describe = 'Get started with HubSpot development';

type GetStartedArgs = CommonArgs & ConfigArgs;

export async function handler(
  args: ArgumentsCamelCase<GetStartedArgs>
): Promise<void> {
  setLogLevel(args);
  trackCommandUsage('get-started');

  const now = new Date();
  logger.log('Welcome to HubSpot CLI!');
  logger.log(`The current time is: ${now.toLocaleString()}`);
  logger.log('More features coming soon...');

  process.exit(EXIT_CODES.SUCCESS);
}

function getStartedBuilder(yargs: Argv): Argv<GetStartedArgs> {
  return yargs as Argv<GetStartedArgs>;
}

export const builder = makeYargsBuilder<GetStartedArgs>(
  getStartedBuilder,
  command,
  'Shows the current time and basic information',
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);
