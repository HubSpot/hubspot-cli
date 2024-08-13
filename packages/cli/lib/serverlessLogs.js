const https = require('https');
const SpinniesManager = require('./ui/SpinniesManager');
const { handleExit, handleKeypress } = require('./process');
const chalk = require('chalk');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { outputLogs } = require('./ui/serverlessFunctionLogs');
const { logError, ApiErrorContext } = require('./errorHandlers/index');

const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { isHubSpotHttpError } = require('@hubspot/local-dev-lib/errors/index');
const {
  isMissingScopeError,
} = require('../../../../hubspot-local-dev-lib/dist/errors');
const {
  SCOPE_GROUPS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('../../../../hubspot-local-dev-lib/dist/constants/auth');
const {
  getAccountConfig,
} = require('../../../../hubspot-local-dev-lib/dist/config');
const {
  fetchScopeData,
} = require('../../../../hubspot-local-dev-lib/dist/api/localDevAuth');
const { i18n } = require('./lang');

const TAIL_DELAY = 5000;

const base64EncodeString = valueToEncode => {
  if (typeof valueToEncode !== 'string') {
    return valueToEncode;
  }

  const stringBuffer = Buffer.from(valueToEncode);
  return encodeURIComponent(stringBuffer.toString('base64'));
};

const handleUserInput = () => {
  const onTerminate = async () => {
    SpinniesManager.remove('tailLogs');
    SpinniesManager.remove('stopMessage');
    process.exit(EXIT_CODES.SUCCESS);
  };

  handleExit(onTerminate);
  handleKeypress(key => {
    if ((key.ctrl && key.name == 'c') || key.name === 'q') {
      onTerminate();
    }
  });
};

async function verifyAccessKeyAndUserAccess(accountId, scopeGroup) {
  const accountConfig = getAccountConfig(accountId);
  // TODO[JOE]: Update this i18n key
  const i18nKey = 'lib.serverless';
  const { authType } = accountConfig;
  if (authType !== PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
    return;
  }

  let scopesData;
  try {
    scopesData = await fetchScopeData(accountId, scopeGroup);
  } catch (e) {
    logger.debug(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.fetchScopeDataError`, {
        scopeGroup,
        error: e,
      })
    );
    return;
  }
  const { portalScopesInGroup, userScopesInGroup } = scopesData;

  if (!portalScopesInGroup.length) {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.portalMissingScope`)
    );
    return;
  }

  if (!portalScopesInGroup.every(s => userScopesInGroup.includes(s))) {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.userMissingScope`)
    );
  } else {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.genericMissingScope`)
    );
  }
}

const tailLogs = async ({
  accountId,
  compact,
  fetchLatest,
  tailCall,
  name,
}) => {
  let initialAfter;

  try {
    const { data: latestLog } = await fetchLatest();
    initialAfter = latestLog && base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (isHubSpotHttpError(e) && e.status !== 404) {
      if (isMissingScopeError(e)) {
        await verifyAccessKeyAndUserAccess(
          accountId,
          SCOPE_GROUPS.CMS_FUNCTIONS
        );
      } else {
        await logError(e, new ApiErrorContext({ accountId }));
      }
    }
  }

  const tail = async after => {
    let latestLog;
    let nextAfter;
    try {
      const { data } = await tailCall(after);
      latestLog = data;
      nextAfter = latestLog.paging.next.after;
    } catch (e) {
      if (isHubSpotHttpError(e) && e.status !== 404) {
        logError(
          e,
          new ApiErrorContext({
            accountId,
          })
        );
      }
      process.exit(EXIT_CODES.SUCCESS);
    }

    if (latestLog && latestLog.results.length) {
      outputLogs(latestLog, {
        compact,
      });
    }

    setTimeout(async () => {
      await tail(nextAfter);
    }, TAIL_DELAY);
  };

  SpinniesManager.init();

  SpinniesManager.add('tailLogs', {
    text: `Following logs for ${name}`,
  });
  SpinniesManager.add('stopMessage', {
    text: `> Press ${chalk.bold('q')} to stop following`,
    status: 'non-spinnable',
  });

  handleUserInput();

  await tail(initialAfter);
};

const outputBuildLog = async buildLogUrl => {
  if (!buildLogUrl) {
    logger.debug(
      'Unable to display build output. No build log URL was provided.'
    );
    return;
  }

  return new Promise(resolve => {
    try {
      https
        .get(buildLogUrl, response => {
          if (response.statusCode === 404) {
            resolve('');
          }

          let data = '';
          response.on('data', chunk => {
            data += chunk;
          });
          response.on('end', () => {
            logger.log(data);
            resolve(data);
          });
        })
        .on('error', () => {
          logger.error('The build log could not be retrieved.');
        });
    } catch (e) {
      logger.error('The build log could not be retrieved.');
      resolve('');
    }
  });
};

module.exports = {
  outputBuildLog,
  tailLogs,
};
