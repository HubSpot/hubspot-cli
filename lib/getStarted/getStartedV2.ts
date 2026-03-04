import { LOG_LEVEL, setLogLevel } from '@hubspot/local-dev-lib/logger';
import { trackGetStartedUsage } from '../../lib/getStartedV2Actions.js';
import { renderInteractive } from '../../ui/render.js';
import { getGetStartedFlow } from '../../ui/components/getStarted/GetStartedFlow.js';
import { CommonArgs } from '../../types/Yargs.js';

type GetStartedV2Args = CommonArgs & {
  name?: string;
  dest?: string;
};

export async function runGetStartedV2({
  derivedAccountId,
  name,
  dest,
}: GetStartedV2Args): Promise<void> {
  setLogLevel(LOG_LEVEL.NONE);

  try {
    await renderInteractive(
      getGetStartedFlow({
        derivedAccountId,
        initialName: name,
        initialDest: dest,
      }),
      { fullScreen: true }
    );

    await trackGetStartedUsage(
      { successful: true, step: 'command-completed' },
      derivedAccountId
    );
  } finally {
    setLogLevel(LOG_LEVEL.LOG);
  }
}
