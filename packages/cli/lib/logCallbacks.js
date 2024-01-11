const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('./lang');

function buildLogCallbacks(logData) {
  const callbacksObject = {};
  for (let key in logData) {
    if (typeof logData[key] === 'string') {
      callbacksObject[key] = interpolationData =>
        logger.log(i18n(logData[key], interpolationData));
    } else {
      callbacksObject[key] = interpolationData =>
        logger[logData[key].type](i18n(logData[key].key, interpolationData));
    }
  }
  return callbacksObject;
}

module.exports = {
  buildLogCallbacks,
};
