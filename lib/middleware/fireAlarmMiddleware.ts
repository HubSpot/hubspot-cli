import { Arguments, terminalWidth } from 'yargs';
import chalk from 'chalk';
import { fetchFireAlarms } from '@hubspot/local-dev-lib/api/fireAlarm';
import { FireAlarm } from '@hubspot/local-dev-lib/types/FireAlarm';
import { logger } from '@hubspot/local-dev-lib/logger';
import { debugError } from '../errorHandlers';
import pkg from '../../package.json';
import { UI_COLORS } from '../ui';
import { i18n } from '../lang';

/*
 * Versions can be formatted like this:
 * =7.2.2 -> targets the exact version 7.2.2
 * =7.2.* -> targets all versions with a major of 7 and a minor of 2
 * =7.* -> targets all versions with a major of 7
 * =* -> targets all versions
 * <=7.2.2 -> targets all versions equal to or less than 7.2.2
 * <=7.2.* -> targets all versions equal to or less than 7.2
 */
const WILDCARD = '*';

function isVersionTargeted(
  version: string,
  targetVersionString: string | null
): boolean {
  // Assume we're targeting no versions if no version string is found
  // Target all versions using the * wildcard
  if (!targetVersionString) {
    return false;
  }

  // Only support version targeting for the <= or = operator
  if (
    !targetVersionString.startsWith('<=') &&
    !targetVersionString.startsWith('=')
  ) {
    return false;
  }

  const targetVersion = targetVersionString.substring(
    targetVersionString.indexOf('=') + 1
  );

  // Only allow exact version matching for tagged CLI releases (like -beta)
  if (version.includes('-') || targetVersionString.includes('-')) {
    if (!targetVersionString.startsWith('=')) {
      return false;
    }
    return version === targetVersion;
  }

  const targetVersionParts = targetVersion.split('.');
  const versionParts = version.split('.');

  // Require the wildcard to be explicitly set to target all versions
  if (
    versionParts.length < 3 &&
    versionParts[versionParts.length - 1] !== WILDCARD
  ) {
    return false;
  }

  // Don't allow the less than or equal to operator to be used with the wildcard
  // in the major version part (e.g. <=*)
  if (targetVersionString.startsWith('<=') && versionParts[0] === WILDCARD) {
    return false;
  }

  let targetAnyVersion = false;

  return targetVersionParts.every((targetPart, i) => {
    const versionPart = versionParts[i];

    // Support generic version targeting (like 1.2.*)
    if (targetPart === WILDCARD || targetAnyVersion) {
      targetAnyVersion = true;
      return true;
    }

    // Double check that the target part is a number
    if (isNaN(Number(targetPart))) {
      return false;
    }

    return targetVersionString.startsWith('<=')
      ? Number(versionPart) <= Number(targetPart)
      : Number(versionPart) === Number(targetPart);
  });
}

function isCommandTargeted(
  command: string,
  targetCommandsString: string | null
): boolean {
  // Require the wildcard to be explicitly set to target all commands
  if (!targetCommandsString) {
    return false;
  }

  if (targetCommandsString === WILDCARD) {
    return true;
  }

  const targetCommands = targetCommandsString.split(',');

  return targetCommands.some(cmd => command.startsWith(cmd));
}

function filterFireAlarm(
  fireAlarm: FireAlarm,
  command: string,
  version: string
): boolean {
  const commandIsTargeted = isCommandTargeted(command, fireAlarm.querySelector);
  const versionIsTargeted = isVersionTargeted(
    version,
    fireAlarm.urlRegexPattern
  );

  return commandIsTargeted && versionIsTargeted;
}

async function getFireAlarms(
  accountId: number,
  command: string,
  version: string
): Promise<FireAlarm[]> {
  let relevantAlarms: FireAlarm[] = [];

  try {
    const { data: fireAlarms } = await fetchFireAlarms(accountId);

    relevantAlarms = fireAlarms.filter(fireAlarm =>
      filterFireAlarm(fireAlarm, command, version)
    );
  } catch (error) {
    debugError(error);
  }

  return relevantAlarms;
}

async function logFireAlarms(
  accountId: number,
  command: string,
  version: string
): Promise<void> {
  const alarms = await getFireAlarms(accountId, command, version);

  if (alarms.length > 0) {
    const notifications = alarms.reduce((acc, alarm) => {
      if (alarm.title && alarm.message) {
        return (
          acc +
          `${acc.length > 0 ? '\n\n' : ''}${chalk.bold(alarm.title)}\n${alarm.message}`
        );
      }
      return acc;
    }, '');

    let boxen;

    try {
      // The boxen package is exported as a module, so we have to use a dynamic import
      boxen = (await import('boxen')).default;
    } catch (error) {
      logger.debug(`${i18n('lib.middleware.fireAlarm.failedToLoadBoxen')}`);
      return;
    }

    logger.log(
      boxen(notifications, {
        title: 'Notifications',
        titleAlignment: 'left',
        borderColor: UI_COLORS.MARIGOLD,
        width: terminalWidth() * 0.75,
        margin: 1,
        padding: 1,
        textAlignment: 'left',
        borderStyle: 'round',
      })
    );
  }
}

export async function checkFireAlarms(
  args: Arguments<{ derivedAccountId: number }>
): Promise<void> {
  const { derivedAccountId } = args;
  try {
    await logFireAlarms(derivedAccountId, args._.join(' '), pkg.version);
  } catch (error) {
    debugError(error);
  }
}
