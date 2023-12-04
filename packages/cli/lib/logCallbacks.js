const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('./lang');

function buildLogCallbacks(logData) {
  const callbacksObject = {};
  for (let key in logData) {
    callbacksObject[key] = () => logger.log(i18n(logData[key]));
  }
  return callbacksObject;
}

module.exports = {
  buildLogCallbacks,
};
