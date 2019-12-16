const { trackUsage } = require('@hubspot/cms-lib/api/fileMapper');
const { getPortalConfig } = require('@hubspot/cms-lib');
const { isTrackingAllowed } = require('@hubspot/cms-lib/lib/config');
const { logger } = require('@hubspot/cms-lib/logger');
const { version } = require('../package.json');
const { getPlatform } = require('./environment');
const { setLogLevel } = require('./commonOpts');

const EventClass = {
  USAGE: 'USAGE',
  INTERACTION: 'INTERACTION',
  VIEW: 'VIEW',
  ACTIVATION: 'ACTIVATION',
};

function trackCommandUsage(command, meta = {}, portalId) {
  if (!isTrackingAllowed()) {
    return;
  }
  logger.debug('Attempting to track usage of "%s" command', command);
  let authType;
  if (portalId) {
    const portalConfig = getPortalConfig(portalId);
    authType =
      portalConfig && portalConfig.authType ? portalConfig.authType : 'apiKey';
  }
  setImmediate(async () => {
    try {
      await trackUsage(
        'cli-interaction',
        EventClass.INTERACTION,
        {
          action: 'cli-command',
          os: getPlatform(),
          nodeVersion: process.version,
          version,
          command,
          authType,
          ...meta,
        },
        portalId
      );
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
      nodeVersion: process.version,
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

const trackAuthAction = async (command, authType, step) => {
  if (!isTrackingAllowed()) {
    return;
  }
  try {
    return await trackUsage('cli-interaction', EventClass.INTERACTION, {
      action: 'cli-auth',
      os: getPlatform(),
      nodeVersion: process.version,
      version,
      command,
      authType,
      step,
    });
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
