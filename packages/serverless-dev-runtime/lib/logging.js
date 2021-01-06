const { logger } = require('@hubspot/cms-lib/logger');
const { outputLogs } = require('@hubspot/cms-lib/lib/logs');
const { MAX_RUNTIME } = require('./constants');

const logFunctionExecution = ({
  status,
  payload,
  startTime,
  endTime,
  memoryUsed,
  logs,
  options,
}) => {
  const runTime = endTime - startTime;
  const roundedRuntime = Math.round(runTime * 100);
  const roundedMemoryUsed = Math.round(memoryUsed);
  const executionData = {
    executionTime: runTime,
    log: (logs && logs.length && logs.join('\n')) || '',
    duration: `${roundedRuntime} ms`,
    status,
    createdAt: startTime,
    memory: `${roundedMemoryUsed}/128 MB`,
    id: -1,
    payload,
  };

  outputLogs(executionData, options);

  if (runTime > MAX_RUNTIME) {
    logger.warn(
      `Function runtime ${roundedRuntime}ms exceeded maximum runtime of ${MAX_RUNTIME}. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
    );
  }
};

module.exports = {
  logFunctionExecution,
};
