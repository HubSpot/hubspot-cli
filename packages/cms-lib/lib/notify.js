const fs = require('fs');
const moment = require('moment');
const debounce = require('debounce');
const { logger } = require('../logger');

const notifyQueue = [];
const notifyPromises = [];
const debouncedWaitForActionsToCompleteAndWriteQueueToFile = debounce(
  waitForActionsToCompleteAndWriteQueueToFile,
  500
);

function triggerNotify(filePathToNotify, actionType, filePath, actionPromise) {
  if (filePathToNotify) {
    notifyQueue.push(`${moment().toISOString()} ${actionType}: ${filePath}\n`);
    notifyPromises.push(actionPromise);
    debouncedWaitForActionsToCompleteAndWriteQueueToFile(filePathToNotify);
  }
}

function waitForActionsToCompleteAndWriteQueueToFile(filePathToNotify) {
  const actionOutput = notifyQueue.join('');
  const allNotifyPromisesResolution = Promise.all(notifyPromises);

  notifyPromises.length = 0;
  notifyQueue.length = 0;

  allNotifyPromisesResolution.then(() => {
    const notifyOutput = `${moment().toISOString()} Notify Triggered\n`;
    notifyFilePath(filePathToNotify, actionOutput.concat(notifyOutput));
  });
}

function notifyFilePath(filePathToNotify, outputToWrite) {
  if (filePathToNotify) {
    try {
      fs.appendFileSync(filePathToNotify, outputToWrite);
    } catch (e) {
      logger.error(`Unable to notify file ${filePathToNotify}: ${e}`);
    }
  }
}

module.exports = {
  triggerNotify,
};
