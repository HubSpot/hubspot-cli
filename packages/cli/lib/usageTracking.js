const { trackUsage } = require('@hubspot/cli-lib/api/fileMapper');
const { getAccountConfig } = require('@hubspot/cli-lib');
const { isTrackingAllowed } = require('@hubspot/cli-lib/lib/config');
const { API_KEY_AUTH_METHOD } = require('@hubspot/cli-lib/lib/constants');
const { logger } = require('@hubspot/cli-lib/logger');
const { version } = require('../package.json');
const { getPlatform } = require('./environment');
const { setLogLevel } = require('./commonOpts');

const EventClass = {
  USAGE: 'USAGE',
  INTERACTION: 'INTERACTION',
  VIEW: 'VIEW',
  ACTIVATION: 'ACTIVATION',
};

const getNodeVersionData = () => ({
  nodeVersion: process.version,
  nodeMajorVersion: (process.version || '').split('.')[0],
});

function trackCommandUsage(command, meta = {}, accountId) {
  if (!isTrackingAllowed()) {
    return;
  }
  logger.debug('Attempting to track usage of "%s" command', command);
  let authType = 'unknown';
  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
    authType =
      accountConfig && accountConfig.authType
        ? accountConfig.authType
        : API_KEY_AUTH_METHOD.value;
  }
  setImmediate(async () => {
    const usageTrackingEvent = {
      action: 'cli-command',
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
      authType,
      ...meta,
    };
    try {
      await trackUsage(
        'cli-interaction',
        EventClass.INTERACTION,
        usageTrackingEvent,
        accountId
      );
      logger.debug('Sent usage tracking command event: %o', usageTrackingEvent);
    } catch (e) {
      logger.debug('Usage tracking failed: %s', e.message);
    }
  });
}

async function trackHelpUsage(command) {
  if (!isTrackingAllowed()) {
    return;
  }
  try {
    if (command) {
      logger.debug('Tracking help usage of "%s" sub-command', command);
    } else {
      logger.debug('Tracking help usage of main command');
    }
    await trackUsage('cli-interaction', EventClass.INTERACTION, {
      action: 'cli-help',
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
    });
  } catch (e) {
    logger.debug('Usage tracking failed: %s', e.message);
  }
}

const addHelpUsageTracking = (program, command) => {
  program.on('--help', () => {
    setLogLevel(program);
    trackHelpUsage(command);
  });
};

const trackAuthAction = async (command, authType, step, accountId) => {
  if (!isTrackingAllowed()) {
    return;
  }
  const usageTrackingEvent = {
    action: 'cli-auth',
    os: getPlatform(),
    ...getNodeVersionData(),
    version,
    command,
    authType,
    step,
  };
  try {
    const response = await trackUsage(
      'cli-interaction',
      EventClass.INTERACTION,
      usageTrackingEvent,
      accountId
    );

    logger.debug('Sent usage tracking command event: %o', usageTrackingEvent);

    return response;
  } catch (e) {
    logger.debug('Auth action tracking failed: %s', e.message);
  }
};

module.exports = {
  trackCommandUsage,
  trackHelpUsage,
  addHelpUsageTracking,
  trackAuthAction,
};
