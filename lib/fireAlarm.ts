import { fetchFireAlarms } from '@hubspot/local-dev-lib/api/fireAlarm';
import { FireAlarm } from '@hubspot/local-dev-lib/types/FireAlarm';
import { logger } from '@hubspot/local-dev-lib/logger';
import { debugError } from './errorHandlers';

/*
 * The messages in the Fire Alarms will be formatted like this:
 * ::=7.2.2::
 * This is the body for the message
 *
 * We use the :: separator to extract the version and the message body
 *
 * Versions can be formatted like this:
 * ::=7.2.2:: -> targets the exact version 7.2.2
 * ::=7.2.*:: -> targets all versions with a major of 7 and a minor of 2
 * ::=7.*:: -> targets all versions with a major of 7
 * ::=*:: -> targets all versions
 * ::<7.2.2:: -> targets all versions equal to or less than 7.2.2
 * ::<7.2.*:: -> targets all versions equal to or less than 7.2
 */
const SEPARATOR = '::';
const VERSION_REGEX = new RegExp(`${SEPARATOR}(.*?)${SEPARATOR}`);
const MESSAGE_REGEX = new RegExp(`${SEPARATOR}.*?${SEPARATOR}(.*)`, 's');
const ANY_VERSION = '*';

const isVersionTargeted = (
  version: string,
  targetVersionString?: string
): boolean => {
  // Assume we're targeting all versions if no version string is found
  if (!targetVersionString) {
    return true;
  }

  const containsOperator =
    targetVersionString.startsWith('<') || targetVersionString.startsWith('=');

  // Assume equals if no operator is found
  const targetVersionsLessThanOrEqualTo =
    containsOperator && targetVersionString[0] === '<';

  const targetVersionStringWithoutOperator = containsOperator
    ? targetVersionString.substring(1)
    : targetVersionString;

  // Ignore any version tags (like -beta)
  const targetVersion = targetVersionStringWithoutOperator.split('-')[0];

  const targetVersionParts = targetVersion.split('.');
  const versionParts = version.split('.');

  return targetVersionParts.every((targetPart, i) => {
    const versionPart = versionParts[i];

    // Support generic version targeting (like 1.2.*)
    if (targetPart === ANY_VERSION) {
      return true;
    }

    return targetVersionsLessThanOrEqualTo
      ? versionPart <= targetPart
      : versionPart === targetPart;
  });
};

const filterFireAlarm = (
  fireAlarm: FireAlarm,
  command: string,
  version: string
) => {
  const targetVersionString = fireAlarm.message.match(VERSION_REGEX)?.[1];
  const targetCommands = fireAlarm.querySelector
    ? fireAlarm.querySelector.split(SEPARATOR)
    : null;

  const commandIsTargeted = !targetCommands || targetCommands.includes(command);
  const versionIsTargeted = isVersionTargeted(version, targetVersionString);

  return commandIsTargeted && versionIsTargeted;
};

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

function logFireAlarm(alarm: FireAlarm) {
  const messageContainsVersion = !!alarm.message.match(VERSION_REGEX);
  const formattedMessage = messageContainsVersion
    ? alarm.message.match(MESSAGE_REGEX)?.[1]
    : alarm.message;

  if (alarm.title && formattedMessage) {
    logger.warn(alarm.title);
    logger.log(formattedMessage.trim());
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
