import { ArgumentsCamelCase, Argv } from 'yargs';
import { isConfigFlagEnabled } from '@hubspot/local-dev-lib/config';
import { CONFIG_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { trackCommandUsage } from '../lib/usageTracking.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { CommonArgs, YargsCommandModule } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { uiLogger } from '../lib/ui/logger.js';
import { commands } from '../lang/en.js';
import { confirmPrompt } from '../lib/prompts/promptUtils.js';
import {
  canCliBeAutoUpgraded,
  installCliVersion,
} from '../lib/cliUpgradeUtils.js';
import { getLatestCliVersion } from '../lib/cliUpgradeUtils.js';
import { pkg } from '../lib/jsonLoader.js';
import SpinniesManager from '../lib/ui/SpinniesManager.js';
import { debugError } from '../lib/errorHandlers/index.js';

export type UpgradeArgs = CommonArgs & {
  version?: string;
  force?: boolean;
  beta?: boolean;
};

const command = ['upgrade [version]', 'update [version]'];
const describe = commands.upgrade.describe;

const handler = async (args: ArgumentsCamelCase<UpgradeArgs>) => {
  const { version, force, beta, derivedAccountId } = args;

  trackCommandUsage('upgrade', {}, derivedAccountId);

  SpinniesManager.init({
    succeedColor: 'white',
  });

  let targetVersion = version;

  try {
    if (!targetVersion) {
      // Get the latest versions
      const { latest: latestCliVersion, next: nextCliVersion } =
        await getLatestCliVersion();
      const latestVersion = beta ? nextCliVersion : latestCliVersion;
      if (!latestVersion) {
        uiLogger.error(commands.upgrade.errors.unableToDetermineLatestVersion);
        return process.exit(EXIT_CODES.ERROR);
      }
      targetVersion = latestVersion;
    }

    const currentVersion = pkg.version;

    // Show what version is available
    if (targetVersion === currentVersion) {
      if (version) {
        uiLogger.log(commands.upgrade.alreadyOnVersion(currentVersion));
      } else {
        uiLogger.log(commands.upgrade.alreadyLatest(currentVersion, beta));
      }

      return process.exit(EXIT_CODES.SUCCESS);
    }

    // Check if globally installed
    const isGlobal = await canCliBeAutoUpgraded();

    if (!isGlobal) {
      uiLogger.log(commands.upgrade.autoUpgradeNotAvailable(targetVersion));

      return process.exit(EXIT_CODES.SUCCESS);
    }

    // Prompt for confirmation unless --force is used
    if (!force) {
      const shouldUpgrade = await confirmPrompt(
        commands.upgrade.confirmPrompt(currentVersion, targetVersion),
        { defaultAnswer: true }
      );

      if (!shouldUpgrade) {
        uiLogger.log(commands.upgrade.cancelled);

        return process.exit(EXIT_CODES.SUCCESS);
      }
    }

    SpinniesManager.add('upgrade', {
      text: commands.upgrade.installing(targetVersion),
    });

    await installCliVersion(targetVersion);
  } catch (e) {
    debugError(e);
    SpinniesManager.fail('upgrade', {
      text: commands.upgrade.errors.installFailed,
    });
    uiLogger.log('');
    uiLogger.error(commands.upgrade.errors.generic);
    return process.exit(EXIT_CODES.ERROR);
  }

  SpinniesManager.succeed('upgrade', {
    text: commands.upgrade.success(targetVersion),
  });

  let isAllowAutoUpdatesEnabled = false;

  try {
    // Default to false if the flag is not set. Users must explicitly enable auto-updates.
    isAllowAutoUpdatesEnabled = isConfigFlagEnabled(
      CONFIG_FLAGS.ALLOW_AUTO_UPDATES,
      false
    );
  } catch (e) {
    debugError(e);
  }

  if (!isAllowAutoUpdatesEnabled && !beta) {
    uiLogger.log('');
    uiLogger.log(commands.upgrade.autoUpgradeMessage);
  }

  return process.exit(EXIT_CODES.SUCCESS);
};

function upgradeBuilder(yargs: Argv): Argv<UpgradeArgs> {
  yargs
    .positional('[version]', {
      describe: commands.upgrade.options.version,
      type: 'string',
    })
    .option('force', {
      alias: 'f',
      describe: commands.upgrade.options.force,
      type: 'boolean',
      default: false,
    })
    .option('beta', {
      alias: 'next',
      describe: commands.upgrade.options.beta,
      type: 'boolean',
      default: false,
    });

  return yargs as Argv<UpgradeArgs>;
}

const builder = makeYargsBuilder<UpgradeArgs>(
  upgradeBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const upgradeCommand: YargsCommandModule<unknown, UpgradeArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default upgradeCommand;
