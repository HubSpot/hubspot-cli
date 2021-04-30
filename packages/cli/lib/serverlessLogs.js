const readline = require('readline');
const ora = require('ora');

const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cli-lib/api/results');

const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { base64EncodeString } = require('@hubspot/cli-lib/lib/encoding');

const TAIL_DELAY = 5000;

const makeSpinner = (functionPath, accountId) => {
  return ora(
    `Waiting for log entries for '${functionPath}' on account '${accountId}'.\n`
  );
};

const makeTailCall = (accountId, functionId) => {
  return async after => {
    const latestLog = await getFunctionLogs(accountId, functionId, { after });
    return latestLog;
  };
};

const handleKeypressToExit = exit => {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key && ((key.ctrl && key.name == 'c') || key.name === 'escape')) {
      exit();
    }
  });
};

const tailLogs = async ({
  functionId,
  functionPath,
  accountId,
  accountName,
  compact,
}) => {
  const tailCall = makeTailCall(accountId, functionId);
  const spinner = makeSpinner(functionPath, accountName || accountId);
  let initialAfter;

  spinner.start();

  try {
    const latestLog = await getLatestFunctionLog(accountId, functionId);
    initialAfter = base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (e.statusCode !== 404) {
      await logServerlessFunctionApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, functionPath })
      );
    }
  }

  const tail = async after => {
    const latestLog = await tailCall(after);

    if (latestLog.results.length) {
      spinner.clear();
      outputLogs(latestLog, {
        compact,
      });
    }

    setTimeout(() => {
      tail(latestLog.paging.next.after);
    }, TAIL_DELAY);
  };

  handleKeypressToExit(() => {
    spinner.stop();
    process.exit();
  });
  tail(initialAfter);
};

module.exports = {
  tailLogs,
};
