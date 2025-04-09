import { fetchFireAlarms } from '@hubspot/local-dev-lib/api/fireAlarm';
import { FireAlarm } from '@hubspot/local-dev-lib/types/FireAlarm';
import { logger } from '@hubspot/local-dev-lib/logger';
import { debugError } from './errorHandlers';

/*
 * Versions can be formatted like this:
 * =7.2.2 -> targets the exact version 7.2.2
 * =7.2.* -> targets all versions with a major of 7 and a minor of 2
 * =7.* -> targets all versions with a major of 7
 * =* -> targets all versions
 * <=7.2.2 -> targets all versions equal to or less than 7.2.2
 * <=7.2.* -> targets all versions equal to or less than 7.2
 */
const VERSION_WILDCARD = '*';

function isVersionTargeted(
  version: string,
  targetVersionString: string | null
): boolean {
  // Assume we're targeting no versions if no version string is found
  // Target all versions using the * wildcard
  if (!targetVersionString) {
    return false;
  }

  // Ignore alerts on any version tags (like -beta)
  // No need for us to send alerts for these beta CLI versions
  if (version.includes('-') || targetVersionString.includes('-')) {
    return false;
  }

  // Only support version targeting for the <= or = operator
  if (
    !targetVersionString.startsWith('<=') ||
    !targetVersionString.startsWith('=')
  ) {
    return false;
  }

  const targetVersion = targetVersionString.substring(
    targetVersionString.indexOf('=') + 1
  );

  const targetVersionParts = targetVersion.split('.');
  const versionParts = version.split('.');

  let targetAnyVersion = false;

  return targetVersionParts.every((targetPart, i) => {
    const versionPart = versionParts[i];

    // Support generic version targeting (like 1.2.*)
    if (targetPart === VERSION_WILDCARD || targetAnyVersion) {
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

function filterFireAlarm(
  fireAlarm: FireAlarm,
  command: string,
  version: string
): boolean {
  const targetCommands = fireAlarm.querySelector
    ? fireAlarm.querySelector.split(',')
    : null;

  const commandIsTargeted =
    !targetCommands || targetCommands.some(cmd => command.startsWith(cmd));
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

    console.log('fireAlarms', fireAlarms);
    relevantAlarms = fireAlarms.filter(fireAlarm =>
      filterFireAlarm(fireAlarm, command, version)
    );
  } catch (error) {
    debugError(error);
  }

  return relevantAlarms;
}

function logFireAlarm(alarm: FireAlarm): void {
  if (alarm.title && alarm.message) {
    logger.warn(alarm.title);
    logger.log(alarm.message.trim());
    logger.log();
  }
}

export async function logFireAlarms(
  accountId: number,
  command: string,
  version: string
): Promise<void> {
  const alarms = await getFireAlarms(accountId, command, version);

  logger.log('--------------------------------');
  alarms.forEach(logFireAlarm);
  logger.log('--------------------------------');
}
