const https = require('https');
const readline = require('readline');

const { logger } = require('@hubspot/cli-lib/logger');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  logServerlessFunctionApiErrorInstance,
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { base64EncodeString } = require('@hubspot/cli-lib/lib/encoding');

const TAIL_DELAY = 5000;

const handleKeypressToExit = exit => {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key && ((key.ctrl && key.name == 'c') || key.name === 'escape')) {
      exit(key.name === 'escape' ? 'esc' : 'ctrl+c');
    }
  });
};

const tailLogs = async ({
  accountId,
  compact,
  spinnies,
  fetchLatest,
  tailCall,
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
      spinnies.fail('tailLogs', { text: 'Stopped polling due to error.' });
      if (e.statusCode !== 404) {
        logApiErrorInstance(
          e,
          new ApiErrorContext({
            accountId,
          })
        );
      }
      process.exit();
    }

    if (latestLog && latestLog.results.length) {
      outputLogs(latestLog, {
        compact,
      });
    }

    setTimeout(() => {
      tail(nextAfter);
    }, TAIL_DELAY);
  };

  handleKeypressToExit(exitKey => {
    spinnies.succeed('tailLogs', {
      text: `Stopped polling because "${exitKey}" was pressed.`,
    });
    process.exit();
  });
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
