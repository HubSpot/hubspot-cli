const https = require('https');
const SpinniesManager = require('./SpinniesManager');
const { handleExit, handleKeypress } = require('./process');
const chalk = require('chalk');
const { logger } = require('@hubspot/cli-lib/logger');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  logServerlessFunctionApiErrorInstance,
  logApiErrorInstance,
  ApiErrorContext,
} = require('./errorHandlers/apiErrors');
const { base64EncodeString } = require('@hubspot/cli-lib/lib/encoding');

const { EXIT_CODES } = require('../lib/enums/exitCodes');

const TAIL_DELAY = 5000;

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

const tailLogs = async ({
  accountId,
  compact,
  fetchLatest,
  tailCall,
  name,
}) => {
  let initialAfter;

  try {
    const latestLog = await fetchLatest();
    initialAfter = latestLog && base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (e.statusCode !== 404) {
      await logServerlessFunctionApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId })
      );
    }
  }

  const tail = async after => {
    let latestLog;
    let nextAfter;
    try {
      latestLog = await tailCall(after);
      nextAfter = latestLog.paging.next.after;
    } catch (e) {
      if (e.statusCode !== 404) {
        logApiErrorInstance(
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
