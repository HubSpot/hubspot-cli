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

/**
 * Collects actions that have been taken on files and the corresponding Promise
 * for the remote action that is in-process
 *
 * @param {string} filePathToNotify Path to the file that should be notified
 * @param {string} actionType Verb to prepend before filepath
 * @param {string} filePath File that has been added/changed/deleted
 * @param {Promise} actionPromise Promise that will resolve when remote action for "filePath" has completed
 */

function triggerNotify(filePathToNotify, actionType, filePath, actionPromise) {
  if (filePathToNotify) {
    notifyQueue.push(`${moment().toISOString()} ${actionType}: ${filePath}\n`);
    notifyPromises.push(actionPromise);
    debouncedWaitForActionsToCompleteAndWriteQueueToFile(filePathToNotify);
  }
}

/**
 * Clears both the notifyQueue and notifyPromises array, generates the output
 * string that will be eventually logged, and waits for all promises currently
 * in the notifyPromises array to resolve before logging the output
 *
 * @param {string} filePathToNotify
 */
function waitForActionsToCompleteAndWriteQueueToFile(filePathToNotify) {
  const actionOutput = notifyQueue.splice(0, notifyQueue.length).join('');
  const allNotifyPromisesResolution = Promise.all(
    notifyPromises.splice(0, notifyPromises.length)
  );

  allNotifyPromisesResolution.then(
    notifyFilePath(filePathToNotify, actionOutput)
  );
}

/**
 * Logs output to the "notify" file
 *
 * @param {string} filePathToNotify File that will be logged to
 * @param {string} outputToWrite What gets logged to the file
 */
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
