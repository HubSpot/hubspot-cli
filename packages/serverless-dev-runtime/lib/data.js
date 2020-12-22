const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { getMockedDataFromDotEnv, getSecrets } = require('./secrets');
const { DEFAULTS, MAX_SECRETS } = require('./constants');

const getValidatedFunctionData = functionPath => {
  if (!fs.existsSync(functionPath)) {
    logger.error(`The path ${functionPath} does not exist.`);
    return;
  } else {
    const stats = fs.lstatSync(functionPath);
    if (!stats.isDirectory()) {
      logger.error(`${functionPath} is not a valid functions directory.`);
      return;
    }
  }

  const { endpoints = [], environment = {}, secrets = [] } = JSON.parse(
    fs.readFileSync(`${functionPath}/serverless.json`, {
      encoding: 'utf-8',
    })
  );
  const routes = Object.keys(endpoints);

  if (!routes.length) {
    logger.error(`No endpoints found in ${functionPath}/serverless.json.`);
    return;
  }

  if (secrets.length > MAX_SECRETS) {
    logger.warn(
      `This function currently exceeds the limit of ${MAX_SECRETS} secrets. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
    );
  }

  return {
    srcPath: functionPath,
    endpoints,
    environment,
    routes,
    secrets,
  };
};

const getHeaders = req => {
  const reqHeaders = req.headers;

  return {
    Accept: reqHeaders.accept,
    'Accept-Encoding': reqHeaders['accept-encoding'],
    'Accept-Language': reqHeaders['accept-language'],
    'Cache-Control': reqHeaders['cache-control'],
    Connection: reqHeaders.connection,
    Cookie: reqHeaders.cookie,
    Host: reqHeaders.host,
    'True-Client-IP': req.ip, // https://stackoverflow.com/a/14631683/3612910
    'upgrade-insecure-requests': reqHeaders['upgrade-insecure-requests'],
    'User-Agent': reqHeaders['user-agent'],
    'X-Forwarded-For':
      req.headers['x-forwarded-for'] || req.connection.remoteAddress, // https://stackoverflow.com/a/14631683/3612910
  };
};

const getFunctionDataContext = async (
  req,
  functionPath,
  allowedSecrets,
  accountId,
  contact
) => {
  const secretValues = getSecrets(functionPath, allowedSecrets);
  const {
    HUBSPOT_LIMITS_TIME_REMAINING,
    HUBSPOT_LIMITS_EXECUTIONS_REMAINING,
    HUBSPOT_CONTACT_VID,
    HUBSPOT_CONTACT_IS_LOGGED_IN,
    HUBSPOT_CONTACT_LIST_MEMBERSHIPS,
  } = getMockedDataFromDotEnv(functionPath);
  const data = {
    secrets: secretValues,
    params: req.query,
    limits: {
      timeRemaining:
        HUBSPOT_LIMITS_TIME_REMAINING || DEFAULTS.HUBSPOT_LIMITS_TIME_REMAINING,
      executionsRemaining:
        HUBSPOT_LIMITS_EXECUTIONS_REMAINING ||
        DEFAULTS.HUBSPOT_LIMITS_EXECUTIONS_REMAINING,
    },
    body: req.body,
    headers: getHeaders(req),
    accountId,
    contact:
      contact === 'true' || contact === true
        ? {
            vid:
              parseInt(HUBSPOT_CONTACT_VID, 10) || DEFAULTS.HUBSPOT_CONTACT_VID,
            isLoggedIn:
              HUBSPOT_CONTACT_IS_LOGGED_IN ||
              DEFAULTS.HUBSPOT_CONTACT_IS_LOGGED_IN,
            listMemberships:
              (HUBSPOT_CONTACT_LIST_MEMBERSHIPS &&
                HUBSPOT_CONTACT_LIST_MEMBERSHIPS.split(',')) ||
              DEFAULTS.HUBSPOT_CONTACT_LIST_MEMBERSHIPS,
          }
        : null,
  };

  return data;
};

module.exports = {
  getValidatedFunctionData,
  getFunctionDataContext,
};
