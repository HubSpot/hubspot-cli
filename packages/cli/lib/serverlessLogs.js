const readline = require('readline');

const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { base64EncodeString } = require('@hubspot/cli-lib/lib/encoding');

const TAIL_DELAY = 5000;

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
  accountId,
  compact,
  spinner,
  fetchLatest,
  tailCall,
}) => {
  let initialAfter;

  spinner.start();

  try {
    const latestLog = await fetchLatest();
    initialAfter = base64EncodeString(latestLog.id);
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
