import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  buildPackage,
  getBuildStatus,
} from '@hubspot/local-dev-lib/api/functions';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';

import SpinniesManager from '../../lib/ui/SpinniesManager.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { uiAccountDescription } from '../../lib/ui/index.js';
import { poll } from '../../lib/polling.js';
import { outputBuildLog } from '../../lib/serverlessLogs.js';
import { commands } from '../../lang/en.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

type FunctionBuildError = {
  status: 'ERROR';
  errorReason: string;
  cdnUrl: string;
};

function isFunctionBuildError(e: unknown): e is FunctionBuildError {
  return (
    typeof e === 'object' && e !== null && 'status' in e && e.status === 'ERROR'
  );
}

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
    uiLogger.error(
      commands.function.subcommands.deploy.errors.notFunctionsFolder(
        functionPath
      )
    );
    return;
  }

  uiLogger.debug(
    commands.function.subcommands.deploy.debug.startingBuildAndDeploy(
      functionPath
    )
  );

  SpinniesManager.init();

  SpinniesManager.add('loading', {
    text: commands.function.subcommands.deploy.loading(
      functionPath,
      uiAccountDescription(derivedAccountId)
    ),
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
      uiLogger.success(
        commands.function.subcommands.deploy.success.deployed(
          functionPath,
          derivedAccountId,
          buildTimeSeconds
        )
      );
    }
  } catch (e: unknown) {
    SpinniesManager.fail('loading', {
      text: commands.function.subcommands.deploy.loadingFailed(
        functionPath,
        uiAccountDescription(derivedAccountId)
      ),
    });

    if (isHubSpotHttpError(e) && e.status === 404) {
      uiLogger.error(
        commands.function.subcommands.deploy.errors.noPackageJson(functionPath)
      );
    } else if (isFunctionBuildError(e)) {
      await outputBuildLog(e.cdnUrl);
      uiLogger.error(
        commands.function.subcommands.deploy.errors.buildError(
          String(e.errorReason)
        )
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
    describe: commands.function.subcommands.deploy.positionals.path.describe,
    type: 'string',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      commands.function.subcommands.deploy.examples.default,
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
