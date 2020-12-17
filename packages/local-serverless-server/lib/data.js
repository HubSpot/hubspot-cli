const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { MAX_SECRETS } = './constants';

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

  const { endpoints, environment, secrets } = JSON.parse(
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

module.exports = {
  getValidatedFunctionData,
};
