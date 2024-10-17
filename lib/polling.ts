// @ts-nocheck
const { POLLING_DELAY, POLLING_STATUS } = require('./constants');

const poll = (callback, accountId, taskId) => {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const { data: pollResp } = await callback(accountId, taskId);
        const { status } = pollResp;

        if (status === POLLING_STATUS.SUCCESS) {
          clearInterval(pollInterval);
          resolve(pollResp);
        } else if (
          status === POLLING_STATUS.ERROR ||
          status === POLLING_STATUS.REVERTED ||
          status === POLLING_STATUS.FAILURE
        ) {
          clearInterval(pollInterval);
          reject(pollResp);
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, POLLING_DELAY);
  });
};

module.exports = {
  poll,
};
