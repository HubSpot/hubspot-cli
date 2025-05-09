import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  buildPackage,
  getBuildStatus,
} from '@hubspot/local-dev-lib/api/functions';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';

import SpinniesManager from '../../lib/ui/SpinniesManager';
import { trackCommandUsage } from '../../lib/usageTracking';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { uiAccountDescription } from '../../lib/ui';
import { poll } from '../../lib/polling';
import { outputBuildLog } from '../../lib/serverlessLogs';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'deploy <path>';
const describe = undefined;

type FunctionDeployArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { path: string };

async function handler(
  args: ArgumentsCamelCase<FunctionDeployArgs>
): Promise<void> {
  const { path: functionPath, derivedAccountId } = args;
  const splitFunctionPath = functionPath.split('.');

  trackCommandUsage('function-deploy', undefined, derivedAccountId);

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    logger.error(
      i18n('commands.function.subcommands.deploy.errors.notFunctionsFolder', {
        functionPath,
      })
    );
    return;
  }

  logger.debug(
    i18n('commands.function.subcommands.deploy.debug.startingBuildAndDeploy', {
      functionPath,
    })
  );

  SpinniesManager.init();

  SpinniesManager.add('loading', {
    text: i18n('commands.function.subcommands.deploy.loading', {
      account: uiAccountDescription(derivedAccountId),
      functionPath,
    }),
  });

  try {
    const { data: buildId } = await buildPackage(
      derivedAccountId,
      functionPath
    );
    const successResp = await poll(() =>
      getBuildStatus(derivedAccountId, Number(buildId))
    );
    if (successResp) {
      const buildTimeSeconds = successResp.buildTime
        ? (successResp.buildTime / 1000).toFixed(2)
        : 0;

      SpinniesManager.succeed('loading');

      if (successResp.cdnUrl) {
        await outputBuildLog(successResp.cdnUrl);
      }
      logger.success(
        i18n('commands.function.subcommands.deploy.success.deployed', {
          accountId: derivedAccountId,
          buildTimeSeconds,
          functionPath,
        })
      );
    }
  } catch (e: unknown) {
    SpinniesManager.fail('loading', {
      text: i18n('commands.function.subcommands.deploy.loadingFailed', {
        account: uiAccountDescription(derivedAccountId),
        functionPath,
      }),
    });

    if (isHubSpotHttpError(e) && e.status === 404) {
      logger.error(
        i18n('commands.function.subcommands.deploy.errors.noPackageJson', {
          functionPath,
        })
      );
    } else if (
      typeof e === 'object' &&
      e !== null &&
      'status' in e &&
      e.status === 'ERROR' &&
      'cdnUrl' in e &&
      'errorReason' in e
    ) {
      await outputBuildLog(e.cdnUrl as string);
      logger.error(
        i18n('commands.function.subcommands.deploy.errors.buildError', {
          details: String(e.errorReason),
        })
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: functionPath,
        })
      );
    }
  }
}

function functionDeployBuilder(yargs: Argv): Argv<FunctionDeployArgs> {
  yargs.positional('path', {
    describe: i18n(
      'commands.function.subcommands.deploy.positionals.path.describe'
    ),
    type: 'string',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      i18n('commands.function.subcommands.deploy.examples.default'),
    ],
  ]);

  return yargs as Argv<FunctionDeployArgs>;
}

const builder = makeYargsBuilder<FunctionDeployArgs>(
  functionDeployBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const functionDeployCommand: YargsCommandModule<unknown, FunctionDeployArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default functionDeployCommand;
