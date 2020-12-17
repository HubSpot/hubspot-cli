const { logger } = require('@hubspot/cms-lib/logger');
const { processLog } = require('@hubspot/cms-lib/lib/logs');

const { MAX_RUNTIME } = './lib/constants';

const logFunctionExecution = (status, payload, startTime, endTime, logs) => {
  const runTime = endTime - startTime;
  const roundedRuntime = Math.round(runTime * 100);
  const executionData = {
    executionTime: runTime,
    log: logs.join('\n'),
    duration: `${roundedRuntime} ms`,
    status,
    createdAt: startTime,
    memory: '74/128 MB',
    id: -1,
    payload,
  };

  logger.log(processLog(executionData, {}));

  if (runTime > MAX_RUNTIME) {
    logger.warn(
      `Function runtime ${roundedRuntime}ms exceeded maximum runtime of ${MAX_RUNTIME}. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
    );
  }
};

module.exports = {
  logFunctionExecution,
};
