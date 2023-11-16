const { logger } = require('@hubspot/cli-lib/logger');

function buildLogCallbacks(logData) {
  const callbacksObject = {};
  for (let key in logData) {
    callbacksObject[key] = () => logger.log(logData[key]);
  }
  return callbacksObject;
}

module.exports = {
  buildLogCallbacks,
};
